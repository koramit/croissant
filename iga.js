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
        console.table(patients);
        fs.writeFileSync('./storage/output/pr' + year + '.json', JSON.stringify(patients));
        console.log('failed : ' + patients.filter(p => !p.dx1).length);
    } finally {
        await driver.quit();
    }
})();

async function jar(driver, url) {
    let report = {};
    report.sno = url;
    await driver.get('http://localhost:7777/storage/html/' + year + '/' + url + '.html');

    await driver.findElement(By.xpath('html/body/div[1]/table[2]/tbody/tr[1]/td[4]/p')).getText().then(async text => {
        report.hn = text;
    });

    await driver.findElement(By.xpath('/html/body/div[1]/table[2]/tbody/tr[4]/td[2]/p')).getText().then(async text => {
        report.date_collection = text;
    });

    let lines = null
    console.log(report.sno);

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
                lines = text.split("\n");
            });
        }

        extractDiag(lines, report);
    } catch (NoSuchElementError) {
        report.kidney = null;
        report.dx1 = null;
        report.dx2 = null;
        report.dx3 = null;
        report.clinical = null;
    }


    return report;
}

function extractDiag(text, report) {
    // native or graft
    report.kidney = text[1].indexOf('transplant') === -1 ? 'native' : 'graft';

    // diagnosis
    report.dx1 = null;
    report.dx2 = null;
    report.dx3 = null;
    let dx = (text[0].indexOf('Diagnosis:') === -1) ? text[1].split('biopsy:')[1].trim() : text[0].split(':')[1].trim();
    if (dx) {
        if (dx.indexOf('1)') === -1) {
            report.dx1 = dx.replace('(see comment)', '').trim();
        } else {
            report.dx1 = dx.split(' 2)')[0].replace('1)', '').replace('(see comment)', '').trim();
            report.dx2 = dx.split(' 2)')[1].replace('(see comment)', '').trim();
        }

        if (report.dx1.indexOf(' 2. ') !== -1) {
            dx = report.dx1.replace('1. ', '').replace('2. ', '|').replace('3. ', '|');
            dx = dx.split('|');
            report.dx1 = dx[0].trim();
            report.dx2 = dx[1].trim();
            report.dx3 = dx[2] === undefined ? null : dx[2].trim();
        }
    } else {
        report.dx1 = text[2].replace('1.', '').trim();
        if (text[3].indexOf('2.') !== -1) {
            report.dx2 = text[3].replace('2.', '').trim();
        }
    }

    // clinical
    for (let i = 1; i < text.length; i++) {
        if (text[i].indexOf('Clinical presentation') !== -1) {
            report.clinical = text[i + 1];
        }
    }

    // oxford classification
    if (report.dx1.indexOf('IgA') !== -1) {
        for (let i = 1; i < text.length; i++) {
            if (text[i].indexOf('Oxford classification') !== -1) {
                report.oxford = text[i].split(':')[1].trim();
            }
        }
    }
}