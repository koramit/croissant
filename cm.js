// https://www.selenium.dev/selenium/docs/api/javascript/module/selenium-webdriver/chrome_exports_Driver.html#executeAsyncScript

const { Builder, By, Key, until } = require('selenium-webdriver');
const { default: axios } = require('axios');
const fs = require('fs');
const configs = JSON.parse(fs.readFileSync('configs.json'));
let driver;
const logs = [];
const callbackScript = `
var callback = arguments[arguments.length - 1];
var xhr = new XMLHttpRequest();
xhr.open("GET", "/v4/api/eclair/cumulative3/hn/cacheMode", true);
xhr.onreadystatechange = function () {
    if (xhr.readyState == 4) {
        callback(xhr.responseText);
    }
};
xhr.send('');
`;

(async function main() {
    let result;
    let patient;
    let response;
    let cacheAge;
    let cacheMode;
    let cmOptions = { data: { token: configs.cm.token }, headers: { 'Content-Type': 'application/json' } };

    await initDriver();

    while (true) {
        patient = await axios.get(configs.cm.endpoint, cmOptions)
            .then(response => response.data)
            .catch(() => {
                console.log('failed to load data');
            });

        if (patient.finished) {
            break;
        }

        console.log('start for : ' + patient.hn);

        response = await callResult(patient.hn); // retry and relogin included

        if (response.status !== 200) {
            logger(patient.hn, response.status);
            console.log(response);
            await driver.sleep(2000);
            continue;
        }

        result = getResult(response.payload, patient.date);
        if (result.ok) {
            patient.result = result.value;

            // post result

            await driver.get(configs.cm.viewUrl + patient.hn);
            await driver.sleep(2000);
        } else {
            cacheAge = (response.cacheAge ?? 0) / (-60000);
            cacheMode = cacheAge > 30 ? 'NO_CACHE' : 'CACHE'; // if > 30 minutes then call NO_CACHE next time
            logger(patient.hn, response.status, cacheMode);
        }

        console.log(result.value);
        console.log('wait 5 secs');
        await driver.sleep(5000);
    }

    await driver.quit();
})();

async function callResult(hn) {
    let response;
    let retry = 0;
    let log = logs.find(l => l.hn === hn);
    let cacheMode = log === undefined ? 'CACHE' : log.cacheMode;
    let callbackStr = callbackScript.replace('hn', hn).replace('cacheMode', cacheMode);

    try {
        do {
            response = await driver.executeAsyncScript(callbackStr).then((str) => JSON.parse(str));
            retry++;
            await driver.sleep(2000);
            if (response.status === 401) {
                await initDriver();
            }
        } while ((response.status ?? 400) !== 200 && retry < 3);
    } catch (error) {
        response = { status: 555 };
    }
    if (response.status !== 200) {
        response.message = cacheMode;
        response.attemp = retry;
    }

    return response;
}

function getResult(payload, dateReff) {
    let covid = payload.find(cat => ['**SARS-CoV-2(COVID-19)RNA', 'MOLECULAR DIAGNOSIS'].includes(cat.category_name));
    if (covid === undefined) {
        return { ok: false, value: 'no category' };
    }

    let result = covid.data.find(cat => cat.name === '**SARS-CoV-2(COVID-19)RNA');
    if (result === undefined || !result.result.length) {
        return { ok: false, value: 'no lab' };
    }

    result = result.result.reverse()[0];

    if (result.date !== dateReff) {
        return { ok: false, value: 'no date' };
    }

    if (!['Detected', 'Not detected', 'Inconclusive'].includes(result.value)) {
        return { ok: false, value: 'pending' };
    }

    return { ok: true, value: result.value };
}

function logger(hn, status, cacheMode = 'CACHE') {
    let log = logs.find(p => p.hn === hn);
    if (log === undefined) {
        logs.push({ hn: hn, status: status, count: 1, cacheMode: cacheMode });
    } else {
        log.status = status;
        log.count = log.count + 1;
    }
}

async function initDriver() {
    if (driver) {
        await driver.quit();
    }

    driver = await new Builder()
        .withCapabilities({
            'browserName': 'chrome',
            'chromeOptions': {
                'excludeSwitches': ['disable-popup-blocking']
            }
        })
        .forBrowser('chrome')
        .build();

    try {
        await driver.get(configs.cm.target);
        await driver.findElement(By.id('username')).clear()
        await driver.findElement(By.id('username')).sendKeys(configs.cm.username);
        await driver.findElement(By.id('password')).sendKeys(configs.cm.password);
        await driver.findElement(By.css('button.submitbt')).click();
        await driver.sleep(2000); // wait for init seesion
    } catch (error) {
        console.log(error);
        await driver.quit();
        console.log('exit');
        process.exit(0);
    }
}