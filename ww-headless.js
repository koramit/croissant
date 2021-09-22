const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const width = 960;
const height = 500;
const fs = require('fs');
const FormData = require('form-data');
const { default: axios } = require('axios');
const labName = '**SARS-CoV-2(COVID-19)RNA';
const moleXPath = '/html/body/table[2]/tbody/tr[7]/td[5]';
const moleXPathNote = '/html/body/table[6]/tbody/tr[2]/td[2]';
const moleXPathSpecimen = '/html/body/table[2]/tbody/tr[5]/td[5]';
const microXPath = '/html/body/table[2]/tbody/tr[5]/td[5]';
const microXPathNote = '/html/body/table[4]/tbody/tr[2]/td[2]';
const microXPathSpecimen = '/html/body/table[2]/tbody/tr[3]/td[5]';
const configs = JSON.parse(fs.readFileSync('configs.json'));
const maxRetry = process.argv[2] ?? 20;
const mode = process.argv[3] ?? 2;
const enableLog = process.argv[4] ?? true;

// now use self signed for endpoint
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

(async function main() {
    let patients = null;
    let patientsNo = null;
    let patientRemain = null;
    await axios.get(configs.ww.yuzuEndpoint, { data: { token: configs.ww.token, mode: mode }, headers: { 'Content-Type': 'application/json' } })
        .then(response => {
            patients = response.data;
            patientsNo = patients.length;
            patientRemain = patientsNo;
        }).catch(() => {
            if (enableLog) {
                console.log('failed to load data');
            }
        });

    let provider = null;
    let xpath = null;
    let xpathNote = null;
    let xpathSpecimen = null;
    let incomplete = true;
    let filename = null;
    let dateMatched = false;
    let waitSeconds = 60000;
    let mainWindow = '';
    let popupWindow = '';
    let waitResultSeconds = 0;
    let rechecked = false;
    let lastRechecked = false;
    let waitForFrame = 0;

    if (patientsNo === 0) {
        process.exit(0);
    }

    const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(new chrome.Options().headless().windowSize({ width, height }))
        .build();

    try {
        await driver.get(configs.target.mainPage);
        await driver.findElement(By.id('UserCodeForm_UserCode')).clear()
        await driver.findElement(By.id('UserCodeForm_UserCode')).sendKeys(configs.target.username);
        await driver.findElement(By.id('PasswordForm_Password')).sendKeys(configs.target.password);
        await driver.findElement(By.id('ButtonSubmit')).click();
        await driver.sleep(1000); // wait for frames loaded, it's seem like after login page initiate frames a bit longer than usual

        while (incomplete) {
            for (const patient of patients.filter(p => !p.result)) {
                if (enableLog) {
                    console.log(patient.hn);
                }
                let frame = await driver.findElement(By.id('EclairMainFrame'));
                await driver.switchTo().frame(frame);
                await driver.findElement(By.id('PatAliasId')).clear();
                await driver.findElement(By.id('PatAliasId')).sendKeys(patient.hn);
                await driver.findElement(By.id('SearchText')).clear();
                await driver.findElement(By.id('SearchText')).sendKeys(labName);
                await driver.findElement(By.id('ObservationAfter')).clear();
                await driver.findElement(By.id('ObservationAfter')).sendKeys(patient.date_after);
                await driver.findElement(By.id('SearchButton')).click();
                await driver.sleep(5000 + waitForFrame);

                await driver.getWindowHandle().then(windowStr => mainWindow = windowStr);

                try {
                    frame = await driver.findElement(By.id('ReportTreeFrame'));
                } catch (NoSuchElementError) {
                    frame = false;
                    await driver.getWindowHandle().then(windowStr => popupWindow = windowStr);
                    if (popupWindow !== mainWindow) {
                        await driver.switchTo().window(popupWindow);
                        await driver.close();
                        await driver.switchTo().window(mainWindow);
                    }
                }

                if (frame === false) {
                    patient.retry = patient.retry + 1;
                    if (enableLog) {
                        console.log('retry ' + patient.retry);
                    }
                    waitForFrame = 2000;
                    await axios.patch(configs.ww.yuzuEndpoint, { token: configs.ww.token, slug: patient.slug, message: 'not found' })
                        .then(() => {
                            if (enableLog) {
                                console.log('feedback OK.');
                            }
                        }).catch(error => {
                            if (enableLog) {
                                console.log('feedback ERROR.');
                            }
                        });
                    if (patient.retry > maxRetry) {
                        patient.result = 'not found';
                        let form = new FormData();
                        form.append('token', configs.ww.token);
                        form.append('slug', patient.slug);
                        form.append('result', patient.result);
                        await axios
                            .post(configs.ww.yuzuEndpoint, form, {
                                headers: { ...form.getHeaders() }
                            })
                            .then(() => console.log('upload OK.'))
                            .catch(error => {
                                if (enableLog) {
                                    console.log('upload ERROR.');
                                }
                            });
                    }
                    if (enableLog) {
                        console.log('not found');
                    }
                } else {
                    waitForFrame = 0;
                    await driver.switchTo().frame(frame);
                    await driver.findElements(By.css('a.TDLITTLE')).then(async doms => {
                        for (const dom of doms) { // can't use forEcah for await
                            try {
                                await dom.getAttribute('id').then(async id => {
                                    if (id.startsWith('Episode')) { // date order
                                        await driver.findElement(By.id(id)).getAttribute('innerText').then(dateLab => {
                                            if (enableLog) {
                                                console.log(dateLab);
                                            }
                                            dateMatched = dateLab.split(' ')[0] === patient.date;
                                        });
                                    } else {
                                        await driver.findElement(By.id(id)).click();
                                        await driver.sleep(2000);

                                        provider = await driver.findElement(By.id(id)).getText().then(text => text);
                                        xpath = provider === 'MOLECULAR DIAGNOSIS' ? moleXPath : microXPath;
                                        xpathNote = provider === 'MOLECULAR DIAGNOSIS' ? moleXPathNote : microXPathNote;
                                        xpathSpecimen = provider === 'MOLECULAR DIAGNOSIS' ? moleXPathSpecimen : microXPathSpecimen;

                                        await driver.switchTo().parentFrame();
                                        await driver.sleep(1000);
                                        frame = await driver.findElement(By.id('ReportDisplayFrame'));
                                        await driver.switchTo().frame(frame);
                                        await driver.sleep(1000);
                                        await driver.findElement(By.xpath(xpath)).getText().then(async result => {
                                            if (enableLog) {
                                                console.log(result);
                                            }
                                            if (dateMatched && result !== 'Result To Follow') {
                                                patient.result = result;
                                                await driver.takeScreenshot().then(async data => {
                                                    let base64Data = data.replace(/^data:image\/png;base64,/, '');
                                                    filename = './screenshots/' + patient.hn + '.png';
                                                    fs.writeFileSync(filename, base64Data, 'base64');
                                                });

                                                try { // if (result.toLowerCase() === 'detected' || result.toLowerCase() === 'inconclusive') {
                                                    await driver.findElement(By.xpath(xpathNote)).getText().then(noteText => {
                                                        patient.note = noteText.replaceAll("\n", ' | ').trim();
                                                        if (enableLog) {
                                                            console.log(patient.note);
                                                        }
                                                    });
                                                } catch (NoSuchElementError) {
                                                    patient.note = null;
                                                }

                                                try {
                                                    await driver.findElement(By.xpath(xpathSpecimen)).getText().then(specimenText => {
                                                        patient.specimen = specimenText.replaceAll("\n", ' | ').trim();
                                                        if (enableLog) {
                                                            console.log(patient.specimen);
                                                        }
                                                    });
                                                } catch (NoSuchElementError) {
                                                    patient.specimen = null;
                                                }

                                                try {
                                                    await driver.findElement(By.xpath('/html/body/div[3]/table/tbody/tr'))
                                                        .getText()
                                                        .then(transaction => {
                                                            patient.transaction = transaction.replaceAll("\n", ' | ').trim();
                                                            if (enableLog) {
                                                                console.log(patient.transaction);
                                                            }
                                                        });
                                                } catch (NoSuchElementError) {
                                                    patient.transaction = null;
                                                }

                                                let form = new FormData();
                                                form.append('token', configs.ww.token);
                                                form.append('slug', patient.slug);
                                                form.append('result', patient.result);
                                                if (patient.note) {
                                                    form.append('note', patient.note);
                                                }
                                                form.append('screenshot', fs.readFileSync(filename), patient.hn + '.png');
                                                if (patient.transaction) {
                                                    form.append('transaction', patient.transaction);
                                                }
                                                if (patient.specimen) {
                                                    form.append('specimen', patient.specimen);
                                                }
                                                await axios
                                                    .post(configs.ww.yuzuEndpoint, form, {
                                                        headers: { ...form.getHeaders() }
                                                    })
                                                    .then(() => {
                                                        fs.unlinkSync(filename);
                                                        if (enableLog) {
                                                            console.log('upload OK.');
                                                        }
                                                    }).catch(error => {
                                                        patient.result = null;
                                                        patient.note = null;
                                                        if (enableLog) {
                                                            console.log('upload ERROR.');
                                                        }
                                                    });
                                                if (enableLog) {
                                                    console.log('retry ' + patient.retry);
                                                }
                                                waitResultSeconds = 0;
                                            } else {
                                                patient.retry = patient.retry + 1;
                                                if (enableLog) {
                                                    console.log('retry ' + patient.retry);
                                                }
                                                await axios.patch(configs.ww.yuzuEndpoint, { token: configs.ww.token, slug: patient.slug, message: 'result to follow' })
                                                    .then(() => {
                                                        if (enableLog) {
                                                            console.log('feedback OK.');
                                                        }
                                                    }).catch(error => {
                                                        console.log('feedback ERROR.');
                                                    });
                                                // extra wait if result to follow
                                                if (patients.filter(p => !p.result).length < 20) {
                                                    waitResultSeconds = Math.floor(Math.random() * 100) + 180;
                                                } else if (patients.filter(p => !p.result).length < 50) {
                                                    waitResultSeconds = Math.floor(Math.random() * 30) + 30;
                                                }
                                                if (patient.retry > (maxRetry + 100)) {
                                                    patient.result = 'timeout';
                                                    let form = new FormData();
                                                    form.append('token', configs.ww.token);
                                                    form.append('slug', patient.slug);
                                                    form.append('result', patient.result);
                                                    await axios
                                                        .post(configs.ww.yuzuEndpoint, form, {
                                                            headers: { ...form.getHeaders() }
                                                        })
                                                        .then(() => {
                                                            if (enableLog) {
                                                                console.log('upload OK.')
                                                            }
                                                        }).catch(error => {
                                                            console.log('upload ERROR.');
                                                        });
                                                }
                                            }
                                        });

                                        await driver.switchTo().parentFrame();
                                        await driver.sleep(1000);
                                        frame = await driver.findElement(By.id('ReportTreeFrame'));
                                        await driver.switchTo().frame(frame);
                                        await driver.sleep(1000);
                                    }
                                });
                            } catch (NoSuchElementError) {
                                if (enableLog) {
                                    console.log('search result NoSuchElementError')
                                }
                                dateMatched = false;
                            }
                            if (patient.result) {
                                break;
                            }
                        }
                    });
                }

                await driver.get(configs.target.searchPage); // shortcut to search
                patientRemain = patients.filter(p => !p.result).length;
                if (enableLog) {
                    console.log('done: ' + (patientsNo - patientRemain) + ' remains: ' + patientRemain + '/' + patientsNo);
                }
                // check are there any cases left
                if (mode === 2) {
                    if (patientRemain === 10 && !rechecked) {
                        rechecked = true;
                        await axios.get(configs.ww.yuzuEndpoint, { data: { token: configs.ww.token, mode: mode }, headers: { 'Content-Type': 'application/json' } })
                            .then(response => patients = response.data)
                    } else if (patientRemain === 1 && !lastRechecked) {
                        lastRechecked = true;
                        await axios.get(configs.ww.yuzuEndpoint, { data: { token: configs.ww.token, mode: mode }, headers: { 'Content-Type': 'application/json' } })
                            .then(response => patients = response.data)
                    }
                }
                if (patientRemain === 0) {
                    waitSeconds = 0;
                } else if (patientRemain < 20) {
                    waitSeconds = 5555;
                } else if (patientRemain < 100) {
                    waitSeconds = 4444;
                } else {
                    waitSeconds = 3333;
                }
                waitSeconds += ((Math.floor(Math.random() * 4) + 1) * 1000);
                waitSeconds += (waitResultSeconds * 1000);
                if (enableLog) {
                    console.log('========== wait for ' + (waitSeconds / 1000) + ' seconds ==========');
                }
                await driver.sleep(waitSeconds);
            }
            incomplete = !(patients.filter(p => p.result).length === patients.length);
        }
    } finally {
        await driver.quit();
    }
})();