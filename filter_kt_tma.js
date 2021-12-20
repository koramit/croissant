const fs = require('fs');
const reports = JSON.parse(fs.readFileSync('./storage/output/patho_all.json')).pathos;

(function main() {
    for (let report of reports) {
        if (
            report.kidney === 'graft' &&
            (
                (report.dx1 ?? '').indexOf(' TMA') !== -1 ||
                (report.dx2 ?? '').indexOf(' TMA') !== -1 ||
                (report.dx3 ?? '').indexOf(' TMA') !== -1 ||
                (report.clinical ?? '').indexOf(' TMA') !== -1 ||
                (report.dx1 ?? '').indexOf('thrombotic') !== -1 ||
                (report.dx2 ?? '').indexOf('thrombotic') !== -1 ||
                (report.dx3 ?? '').indexOf('thrombotic') !== -1 ||
                (report.clinical ?? '').indexOf('thrombotic') !== -1
            )
        ) {
            console.log(report.hn);
        }
        // patient = await jar(driver, report);
        // patients.push(patient);
    }
})();