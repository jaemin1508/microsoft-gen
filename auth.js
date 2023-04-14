function jsonToFormData(json) {
    let data = Object.entries(json);
    const form = data.map(d => d.map(encodeURIComponent));

    let formData = form.map(d => d.join("="));

    return formData.join("&");
}

async function xboxLogin(cookieJar, email, password) {
    const { fetch } = await import("node-fetch-cookies");

    const loginPage = await fetch(cookieJar, "https://login.live.com/login.srf?wa=wsignin1.0&wreply=https%3A%2F%2Faccount.xbox.com%2Fen-us%2Faccountcreation", {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "GET"
    }).then(res => res.text());

    const loginEmailURL = loginPage.match(/(https:\/\/login\.live\.com\/GetCredentialType\.srf\?[^']+)'/)[1];
    const uaid = loginPage.match(/uaid=([\d\w]+)/)[1];
    const flowToken = loginPage.match(/<input type="hidden" name="PPFT" id="i0327" value="([\d\w!\*$]+)"\/>/)[1];

    const loginEmail = await fetch(cookieJar, loginEmailURL, {
        headers: {
            Accept: "application/json",
            "Accept-Language": "en-US,en;q=0.9",
            "client-request-id": uaid,
            Connection: "keep-alive",
            "Content-type": "application/json; charset=UTF-8",
            hpgact: "0",
            hpgid: "33",
            Origin: "https://login.live.com",
            Referer: "https://login.live.com/login.srf?wa=wsignin1.0&wreply=https%3A%2F%2Faccount.xbox.com%2Fen-us%2Faccountcreation",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "POST",
        body: JSON.stringify({
            username: email,
            uaid,
            isOtherIdpSupported: false,
            checkPhones: false,
            isRemoteNGCSupported: true,
            isCookieBannerShown: false,
            isFidoSupported: true,
            forceotclogin: false,
            otclogindisallowed: false,
            isExternalFederationDisallowed: false,
            isRemoteConnectSupported: false,
            federationFlags: 3,
            isSignup: false,
            flowToken
        })
    });

    const loginPasswordURL = loginPage.match(/urlPost:'(https:\/\/login\.live\.com\/ppsecure\/post\.srf\?[^']+)/)[1];

    const loginPassword = await fetch(cookieJar, loginPasswordURL, {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: "https://login.live.com",
            Referer: "https://login.live.com/login.srf?wa=wsignin1.0&wreply=https://account.xbox.com/en-us/accountcreation",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "POST",
        body: jsonToFormData({
            login: email,
            loginfmt: email,
            type: "11",
            LoginOptions: "3",
            passwd: password,
            PPFT: flowToken
        }),
    }).then(res => res.text());

    const loginPostURL = loginPassword.match(/urlPost:'([^']+route=R3_BAY)'/)[1];

    let loginPost = await fetch(cookieJar, loginPostURL, {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: "https://login.live.com",
            Referer: loginPasswordURL,
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "POST",
        body: jsonToFormData({
            LoginOptions: "1",
            type: "28",
            PPFT: flowToken
        })
    }).then(res => res.text());

    let csrfURL = loginPost.match(/action="([^"]+)/)[1];
    let NAPExp = loginPost.match(/id="NAPExp" value="([^"]+)/)[1];
    let NAP = loginPost.match(/id="NAP" value="([^"]+)/)[1];
    let ANON = loginPost.match(/id="ANON" value="([^"]+)/)[1];
    let ANONExp = loginPost.match(/id="ANONExp" value="([^"]+)/)[1];
    let t = loginPost.match(/id="t" value="([^"]+)/)[1];

    let csrfPost = await fetch(cookieJar, csrfURL, {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: "https://login.live.com",
            Referer: "https://login.live.com/",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "POST",
        body: jsonToFormData({
            NAPExp,
            NAP,
            ANON,
            ANONExp,
            t
        }),
        redirect: "manual"
    });

    let csrfPostRedirectURL = csrfPost.headers.get('location');

    loginPost = await fetch(cookieJar, csrfPostRedirectURL, {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
            Referer: "https://login.live.com/",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "GET"
    }).then(res => res.text());

    csrfURL = loginPost.match(/action="([^"]+)/)[1];
    NAPExp = loginPost.match(/id="NAPExp" value="([^"]+)/)[1];
    NAP = loginPost.match(/id="NAP" value="([^"]+)/)[1];
    ANON = loginPost.match(/id="ANON" value="([^"]+)/)[1];
    ANONExp = loginPost.match(/id="ANONExp" value="([^"]+)/)[1];
    t = loginPost.match(/id="t" value="([^"]+)/)[1];
    let pprid = loginPost.match(/id="pprid" value="([^"]+)/)[1];

    csrfPost = await fetch(cookieJar, csrfURL, {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: "https://login.live.com",
            Referer: "https://login.live.com/",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "POST",
        body: jsonToFormData({
            NAPExp,
            pprid,
            NAP,
            ANON,
            ANONExp,
            t
        }),
        redirect: "manual"
    });
    
    csrfPostRedirectURL = csrfPost.headers.get('location');

    loginPost = await fetch(cookieJar, csrfPostRedirectURL, {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
            Referer: "https://login.live.com/",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "GET"
    }).then(res => res.text());

    csrfURL = loginPost.match(/action="([^"]+)/)[1];
    NAPExp = loginPost.match(/id="NAPExp" value="([^"]+)/)[1];
    NAP = loginPost.match(/id="NAP" value="([^"]+)/)[1];
    ANON = loginPost.match(/id="ANON" value="([^"]+)/)[1];
    ANONExp = loginPost.match(/id="ANONExp" value="([^"]+)/)[1];
    t = loginPost.match(/id="t" value="([^"]+)/)[1];
    pprid = loginPost.match(/id="pprid" value="([^"]+)/)[1];

    csrfPost = await fetch(cookieJar, csrfURL, {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: "https://login.live.com",
            Referer: "https://login.live.com/",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "POST",
        body: jsonToFormData({
            NAPExp,
            pprid,
            NAP,
            ANON,
            ANONExp,
            t
        }),
        redirect: "manual"
    });

    if (csrfPost.status === 200) {
        const accountCreationPage = await csrfPost.text();
        const requestVerificationToken = accountCreationPage.match(/name="__RequestVerificationToken" type="hidden" value="([^"]+)/)[1];

        const redirectURL = await fetch(cookieJar, "https://account.xbox.com/en-us/xbox/account/api/v1/accountscreation/CreateXboxLiveAccount", {
            headers: {
                __RequestVerificationToken: requestVerificationToken,
                Accept: "application/json, text/javascript, */*; q=0.01",
                "Accept-Language": "en-US,en;q=0.9",
                Connection: "keep-alive",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                Origin: "https://account.xbox.com",
                Referer: `https://account.xbox.com/en-us/accountcreation?csrf=&wa=wsignin1.0`,
                "Request-Id": "|761de37f7ab24dfe8eb0ca6944a70eef.9bcd70b779434d7c",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-origin",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
                "X-Requested-With": "XMLHttpRequest"
            },
            method: "POST",
            body: jsonToFormData({
                partnerOptInChoice: "false",
                msftOptInChoice: "false",
                isChild: "true",
                returnUrl: ""
            })
        }).then(res => res.text());

        if (redirectURL === '{"Message":"Account creation throws exception"}') {
            throw new Error("[-] Account creation throws exception!");
        }

        await fetch(cookieJar, "https://account.xbox.com" + redirectURL.replace(/"/g, ""), {
            headers: {
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                Connection: "keep-alive",
                Referer: csrfURL,
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin",
                "Upgrade-Insecure-Requests": "1",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
            },
            method: "GET",
            redirect: "manual"
        });

        return true;
    } else {
        await fetch(cookieJar, csrfPost.headers.get('location'), {
            headers: {
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                Connection: "keep-alive",
                Referer: csrfURL,
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin",
                "Upgrade-Insecure-Requests": "1",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
            },
            redirect: "manual"
        });

        return true;
    }
}

async function msLogin(cookieJar, email, password) {
    const loginPage = await fetch(cookieJar, "https://login.live.com/login.srf?wa=wsignin1.0&wreply=https%3A%2F%2Faccount.microsoft.com%2Fauth%2Fcomplete-silent-signin%3Fru%3Dhttps%253A%252F%252Faccount.microsoft.com%252F", {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "GET"
    }).then(res => res.text());

    const loginEmailURL = loginPage.match(/(https:\/\/login\.live\.com\/GetCredentialType\.srf\?[^']+)'/)[1];
    const uaid = loginPage.match(/uaid=([\d\w]+)/)[1];
    const flowToken = loginPage.match(/<input type="hidden" name="PPFT" id="i0327" value="([\d\w!\*$]+)"\/>/)[1];

    const loginEmail = await fetch(cookieJar, loginEmailURL, {
        headers: {
            Accept: "application/json",
            "Accept-Language": "en-US,en;q=0.9",
            "client-request-id": uaid,
            Connection: "keep-alive",
            "Content-type": "application/json; charset=UTF-8",
            hpgact: "0",
            hpgid: "33",
            Origin: "https://login.live.com",
            Referer: "https://login.live.com/login.srf?wa=wsignin1.0&wreply=https%3A%2F%2Faccount.microsoft.com%2Fauth%2Fcomplete-silent-signin%3Fru%3Dhttps%253A%252F%252Faccount.microsoft.com%252F",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "POST",
        body: JSON.stringify({
            username: email,
            uaid,
            isOtherIdpSupported: false,
            checkPhones: false,
            isRemoteNGCSupported: true,
            isCookieBannerShown: false,
            isFidoSupported: true,
            forceotclogin: false,
            otclogindisallowed: false,
            isExternalFederationDisallowed: false,
            isRemoteConnectSupported: false,
            federationFlags: 3,
            isSignup: false,
            flowToken
        })
    });

    const loginPasswordURL = loginPage.match(/urlPost:'(https:\/\/login\.live\.com\/ppsecure\/post\.srf\?[^']+)/)[1];

    const loginPassword = await fetch(cookieJar, loginPasswordURL, {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: "https://login.live.com",
            Referer: "https://login.live.com/login.srf?wa=wsignin1.0&wreply=https%3A%2F%2Faccount.microsoft.com%2Fauth%2Fcomplete-silent-signin%3Fru%3Dhttps%253A%252F%252Faccount.microsoft.com%252F",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "POST",
        body: jsonToFormData({
            login: email,
            loginfmt: email,
            type: "11",
            LoginOptions: "3",
            passwd: password,
            PPFT: flowToken
        })
    }).then(res => res.text());

    const loginPostURL = loginPassword.match(/urlPost:'([^']+route=R3_BAY)'/)[1];

    let loginPost = await fetch(cookieJar, loginPostURL, {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: "https://login.live.com",
            Referer: loginPasswordURL,
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "POST",
        body: jsonToFormData({
            LoginOptions: "1",
            type: "28",
            PPFT: flowToken
        })
    }).then(res => res.text());

    let csrfURL = loginPost.match(/action="([^"]+)/)[1];
    let NAPExp = loginPost.match(/id="NAPExp" value="([^"]+)/)[1];
    let NAP = loginPost.match(/id="NAP" value="([^"]+)/)[1];
    let ANON = loginPost.match(/id="ANON" value="([^"]+)/)[1];
    let ANONExp = loginPost.match(/id="ANONExp" value="([^"]+)/)[1];
    let t = loginPost.match(/id="t" value="([^"]+)/)[1];

    let csrfPost = await fetch(cookieJar, csrfURL, {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: "https://login.live.com",
            Referer: "https://login.live.com/",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "POST",
        body: jsonToFormData({
            NAPExp,
            NAP,
            ANON,
            ANONExp,
            t
        }),
        redirect: "manual"
    });

    let csrfPostRedirectURL = csrfPost.headers.get('location');

    loginPost = await fetch(cookieJar, csrfPostRedirectURL, {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
            Referer: "https://login.live.com/",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "GET"
    }).then(res => res.text());

    csrfURL = loginPost.match(/action="([^"]+)/)[1];
    NAPExp = loginPost.match(/id="NAPExp" value="([^"]+)/)[1];
    NAP = loginPost.match(/id="NAP" value="([^"]+)/)[1];
    ANON = loginPost.match(/id="ANON" value="([^"]+)/)[1];
    ANONExp = loginPost.match(/id="ANONExp" value="([^"]+)/)[1];
    t = loginPost.match(/id="t" value="([^"]+)/)[1];
    let pprid = loginPost.match(/id="pprid" value="([^"]+)/)[1];

    csrfPost = await fetch(cookieJar, csrfURL, {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: "https://login.live.com",
            Referer: "https://login.live.com/",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "POST",
        body: jsonToFormData({
            NAPExp,
            pprid,
            NAP,
            ANON,
            ANONExp,
            t
        }),
        redirect: "manual"
    });
    
    csrfPostRedirectURL = csrfPost.headers.get('location');

    loginPost = await fetch(cookieJar, csrfPostRedirectURL, {
        headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Connection: "keep-alive",
            Referer: "https://login.live.com/",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        },
        method: "GET",
        redirect: "manual"
    }).then(res => res.text());
    if (csrfPost.headers.get('location') === 'https://account.microsoft.com/') {
        return true;
    } else {
        return false;
    }
}

module.exports = { msLogin, xboxLogin };