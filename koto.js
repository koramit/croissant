const robot = require("robotjs");
const fs = require('fs');
const { default: axios } = require('axios');
const { exec } = require("child_process");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const configs = JSON.parse(fs.readFileSync('configs.json')).koto;
const waitInput = 1543;
const waitTargetLoaded = 10987;
const waitProcessed = 15432;
const waitIteration = 567890;
const postOptions = { data: { token: configs.token }, headers: { 'Content-Type': 'application/json' } };

(async function main() {
    // check if work needed
    let order = await axios.post('/#', postOptions)
        .then(res => res.data)
        .catch(error => process.exit(0));

    if (!order.run) {
        process.exit();
    }

    await bootTarget(); // waitInput*6 + waitTargetLoaded => 20.245 secs

    // may need to correct date value

    for (let iter = 1; i <= 5; iter++) {
        await requestService(); // waitInput*3 + waitProcessed*2 => 35.493 secs
        await processService(order.dateReff);
        await sleep(waitIteration); // ~ 10 mins
    }

    downTarget();
})();

async function processService(dateReff) {
    let path = configs.basePath + dateReff + configs.dataType;
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