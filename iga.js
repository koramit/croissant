const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const width = 960;
const height = 500;
const fs = require('fs');
const year = process.argv[2];
const reports = JSON.parse(fs.readFileSync('./storage/data/pr' + year + '.json')).reports;

(async function main() {
    const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(new chrome.Options().headless().windowSize({ width, height }))
        .build();

    try {
        let patients = [];
        let patient = null;
        for (let report of reports) {
            patient = await jar(driver, report);
            patients.push(patient);
        }
        // console.table(patients);
        fs.writeFileSync('./storage/output/pr' + year + '.json', JSON.stringify(patients, null, 4));
        console.log('failed : ' + patients.filter(p => !p.dx1).length);
    } finally {
        await driver.quit();
    }
})();

async function jar(driver, url) {
    let report = {
        sno: null,
        hn: null,
        date_bx: null,
        gender: null,
        age_at_bx: null,
        kidney: null,
        dx1: null,
        dx2: null,
        dx3: null,
        clinical: null,
        M: null,
        E: null,
        S: null,
        T: null,
        C: null
    };
    report.sno = url;
    await driver.get('http://localhost:7777/storage/html/' + year + '/' + url + '.html');

    await driver.findElement(By.xpath('/html/body/div[1]/table[2]/tbody/tr[1]/td[4]/p')).getText().then(async text => {
        report.hn = text;
    });

    await driver.findElement(By.xpath('/html/body/div[1]/table[2]/tbody/tr[4]/td[2]/p')).getText().then(async text => {
        let dateDMY = text.split(' ')[0].split('-');
        report.date_bx = dateDMY[2] + '-' + dateDMY[1] + '-' + dateDMY[0];
    });

    await driver.findElement(By.xpath('/html/body/div[1]/table[2]/tbody/tr[2]/td[2]/p')).getText().then(async text => {
        report.age_at_bx = text;
    });

    await driver.findElement(By.xpath('/html/body/div[1]/table[2]/tbody/tr[2]/td[5]/p')).getText().then(async text => {
        report.gender = text;
    });

    let lines = null
    // console.log(report.sno);

    try {
        await driver.findElement(By.xpath('/html/body/div[2]')).getText().then(async text => {
            lines = text.split("\n");
        });

        if (lines[0].trim().indexOf('Diagnosis') === -1) {
            await driver.findElement(By.xpath('/html/body/div[3]')).getText().then(async text => {
                lines = text.split("\n");
            });
        }

        if (lines[0].trim().indexOf('Diagnosis') === -1) {
            await driver.findElement(By.xpath('/html/body/div[4]')).getText().then(async text => {
                lines = text.split("\n").map(line => line.trim());
            });
        }

        extractDiag(lines, report);
    } catch (NoSuchElementError) {
        // console.log('error');
    }

    return report;
}

function extractDiag(text, report) {
    // native or graft
    report.kidney = text[1].indexOf('transplant') === -1 ? 'native' : 'graft';

    // diagnosis
    let dx = (text[0].indexOf('Diagnosis:') === -1) ? text[1].split('biopsy:')[1].trim() : text[0].split(':')[1].trim();
    if (dx) {
        if (dx.indexOf('1)') === -1) {
            if (dx.indexOf('1.') !== -1) {
                report.dx1 = dx.replace('1.', '').replace('(see comment)', '').trim();
                for (i = 2; i < 6; i++) {
                    if (text[i].trim().startsWith('2.')) {
                        report.dx2 = text[i].trim().replace('2.', '').replace('(see comment)', '').trim();
                    } else if (text[i].trim().startsWith('3.')) {
                        report.dx3 = text[i].trim().replace('3.', '').replace('(see comment)', '').trim();
                    }
                }
            } else {
                report.dx1 = dx.replace('(see comment)', '').trim();
            }
        } else {
            report.dx1 = dx.split(' 2)')[0].replace('1)', '').replace('(see comment)', '').trim();
            report.dx2 = dx.split(' 2)')[1].replace('(see comment)', '').trim();

            if (report.dx2.indexOf('3)') !== -1) {
                let dx2 = report.dx2;
                dx2 = dx2.split('3)');
                report.dx2 = dx2[0].trim();
                report.dx3 = dx2[1].trim();
            }
        }

        if (report.dx1.indexOf(' 2. ') !== -1) {
            dx = report.dx1.replace('1. ', '').replace('2. ', '|').replace('3. ', '|');
            dx = dx.split('|');
            report.dx1 = dx[0].trim();
            report.dx2 = dx[1].trim();
            report.dx3 = dx[2] === undefined ? null : dx[2].trim();
        }
    } else {
        if (text[2].startsWith('-')) {
            report.dx1 = text[2].replace('-', '').trim();
            report.dx2 = text[3].startsWith('-') ? text[3].replace('-', '').trim() : null;
            report.dx3 = text[4].startsWith('-') ? text[4].replace('-', '').trim() : null;
        } else {
            report.dx1 = text[2].replace('1.', '').trim();
            if (text[3].indexOf('2.') !== -1) {
                report.dx2 = text[3].replace('2.', '').trim();

                if (text[4].indexOf('3.') !== -1) {
                    report.dx3 = text[4].replace('3.', '').trim();
                }
            }
        }

    }

    // clinical
    for (let i = 1; i < text.length; i++) {
        if (text[i].indexOf('Clinical presentation') !== -1) {
            report.clinical = text[i + 1];
            break;
        }
    }

    // oxford classification
    if (report.dx1.indexOf('IgA') !== -1) {
        for (let i = 1; i < text.length; i++) {
            if (text[i].indexOf('Oxford classification') !== -1) {
                oxford = text[i].split(':')[1].trim().split(' ');
                report.M = oxford[0] !== undefined ? oxford[0].replace('M', '') : null;
                report.E = oxford[1] !== undefined ? oxford[1].replace('E', '') : null;
                report.S = oxford[2] !== undefined ? oxford[2].replace('S', '') : null;
                report.T = oxford[3] !== undefined ? oxford[3].replace('T', '') : null;
                report.C = oxford[4] !== undefined ? oxford[4].replace('C', '') : null;
                break;
            }
        }
    }
}