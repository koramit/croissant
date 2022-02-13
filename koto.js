const robot = require("robotjs");
const fs = require('fs');
const { exec } = require("child_process");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const configs = JSON.parse(fs.readFileSync('configs.json')).koto;
const waitInput = 1543;
const waitTargetLoaded = 10987;
const waitProcessed = 15432;

(async function main() {
    await bootTarget();
    await requestService();
    await processResponse();
    // wait for next iteration
    downTarget();
})();

async function processResponse() {
    let todayStr = (new Date()).toISOString().split('T')[0];
    let path = configs.basePath + todayStr + configs.dataType;
    try {
        if (!fs.existsSync(path)) {
            // send feedback
            console.log('file not found');

            downTarget();
        }
    } catch (error) {
        console.log(error);
        downTarget();
    }
    // send output
    fs.unlinkSync(path);
}

async function requestService() {
    robot.moveMouse(configs.conner.x, configs.conner.y);
    await sleep(waitInput);
    robot.mouseClick();
    await sleep(waitInput);
    robot.moveMouse(configs.btn2.x, configs.btn2.y);
    await sleep(waitInput);
    robot.mouseClick();
    await sleep(waitProcessed);
    robot.keyTap('enter');
    await sleep(waitProcessed);
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