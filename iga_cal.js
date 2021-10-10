const readXlsxFile = require('read-excel-file/node');
const fs = require('fs');

const keys = [
    'sno',
    'hn',
    'date_bx',
    'gender',
    'age_at_bx',
    'kidney',
    'dx1',
    'dx2',
    'dx3',
    'clinical',
    'M',
    'E',
    'S',
    'T',
    'C',
    'Cr',
    'albumin',
    'SpGr',
    'protein',
    'RBC',
    'u_WBC',
    'OVF',
    'urine_protein_24hr',
    'CrCl',
    'spot_urine_protein',
    'urine_Cr',
    'UPCR',
    'eGFR',
    'Cr_year1',
    'albumin_year1',
    'SpGr_year1',
    'protein_year1',
    'RBC_year1',
    'u_WBC_year1',
    'OVF_year1',
    'urine_protein_24hr_year1',
    'CrCl_year1',
    'spot_urine_protein_year1',
    'urine_Cr_year1',
];

const reports = [];

readXlsxFile('./storage/data/iga_all.xlsx').then((rows) => {
    let report = {};
    for (const row of rows) {
        report = {};
        for (i = 0; i < keys.length; i++) {
            report[keys[i]] = row[i] === 'null' ? null : row[i];
        }

        // UPCR
        if (report.spot_urine_protein && report.urine_Cr) {
            report.UPCR = report.spot_urine_protein / report.urine_Cr;
        } else {
            report.UPCR = null;
        }
        if (report.spot_urine_protein_year1 && report.urine_Cr_year1) {
            report.UPCR_year1 = report.spot_urine_protein_year1 / report.urine_Cr_year1;
        } else {
            report.UPCR_year1 = null;
        }

        // eFGR
        if (report.Cr) {
            let female = report.gender === 'หญิง';
            var cr = report.Cr;
            var age = report.age_at_bx;

            var eGFR;
            eGFR = 141 * Math.pow(Math.min(cr / (female ? 0.7 : 0.9), 1), (female ? -0.329 : -0.411));
            eGFR *= Math.pow(Math.max(cr / (female ? 0.7 : 0.9), 1), -1.209) * Math.pow(0.993, age);
            eGFR *= (female) ? 1.018 : 1;

            report.eGFR = eGFR;
        }

        // eFGR
        if (report.Cr_year1 ?? false) {
            let female = report.gender === 'หญิง';
            var cr = report.Cr_year1;
            var age = report.age_at_bx + 1;

            var eGFR;
            eGFR = 141 * Math.pow(Math.min(cr / (female ? 0.7 : 0.9), 1), (female ? -0.329 : -0.411));
            eGFR *= Math.pow(Math.max(cr / (female ? 0.7 : 0.9), 1), -1.209) * Math.pow(0.993, age);
            eGFR *= (female) ? 1.018 : 1;

            report.eGFR_year1 = eGFR;
        }
        reports.push(report);
    }

    fs.writeFileSync('./storage/output/iga_all.json', JSON.stringify(reports, null, 4));
    console.log('done');
})
