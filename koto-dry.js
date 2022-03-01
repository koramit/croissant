const robot = require("robotjs");
const fs = require('fs');
const { exec } = require("child_process");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const configs = JSON.parse(fs.readFileSync('configs.json')).koto;
const waitInput = 1234;
const waitTargetLoaded = 8765;
const waitProcessed = 60123;

(async function main() {
    await bootTarget(); // waitInput*6 + waitTargetLoaded => 16.169 secs

    let today = new Date();
    let dateArr = [];
    dateArr.push(today.getFullYear());
    dateArr.push((today.getMonth() + '').padStart(2, '0'));
    dateArr.push((today.getDay() + '').padStart(2, '0'));
    today = dateArr.join('-');

    await setDateReff(today.split('-').reverse().join('-')); // waitInput*5 => 6.17 secs

    await requestService(); // waitInput*6 + waitProcessed*1.5 => 142.588 secs

    await processService(today);

    downTarget();
})();

async function setDateReff(dateReff) {
    let inputs = dateReff.split('-');
    for (let i = 0; i < inputs.length; i++) {
        await gotoConner();
        robot.moveMouse(configs['input' + (i + 3)].x, configs['input' + (i + 3)].y);
        await sleep(waitInput);
        robot.mouseClick();
        await sleep(waitInput);
        robot.typeString(inputs[i]);
        await sleep(waitInput);
    }
}

async function processService(dateReff) {
    let path = configs.basePath + dateReff + configs.dataType;
    if (fs.existsSync(path)) {
        fs.unlinkSync(path);
    }
}

async function requestService() {
    await gotoConner();
    robot.moveMouse(configs.btn2.x, configs.btn2.y);
    await sleep(waitInput);
    robot.mouseClick();
    await sleep(waitProcessed * 2.5);
    robot.moveMouse(configs.btn3.x, configs.btn3.y);
    await sleep(waitInput);
    robot.mouseClick();
    await sleep(parseInt(waitProcessed));
    await gotoConner();
}

async function gotoConner() {
    robot.moveMouse(configs.conner.x, configs.conner.y);
    await sleep(waitInput);
    robot.mouseClick();
    await sleep(waitInput);
}

function downTarget() {
    exec(configs.cmdDown, (error, stdout, stderr) => {
        if (error) {
            console.log(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
        process.exit(0);
    })
}

async function bootTarget() {
    // run target
    exec(configs.cmdUp, (error, stdout, stderr) => {
        if (error) {
            console.log(`error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
    });
    // wait for target loaded
    await sleep(waitTargetLoaded);

    // input1 target auto focus
    robot.typeString(configs.input1Val);
    await sleep(waitInput);

    // input2 move from input1
    robot.keyTap('tab');
    await sleep(waitInput);
    robot.keyTap('backspace');
    await sleep(waitInput);
    robot.typeString(configs.input2Val);
    await sleep(waitInput);

    // btn1 move form input2
    robot.keyTap('tab');
    await sleep(waitInput);
    robot.keyTap('backspace');
    await sleep(waitInput);
    robot.keyTap('enter');
    await sleep(waitTargetLoaded);
}