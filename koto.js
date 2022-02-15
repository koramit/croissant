const robot = require("robotjs");
const fs = require('fs');
const { default: axios } = require('axios');
const FormData = require('form-data');
const { exec } = require("child_process");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const configs = JSON.parse(fs.readFileSync('configs.json')).koto;
const waitInput = 1234;
const waitTargetLoaded = 8765;
const waitProcessed = 60123;
const waitIteration = 567890;
const iterations = 5;
const postOptions = { data: { token: configs.token }, headers: { 'Content-Type': 'application/json' } };
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // use internal self signed IP

(async function main() {
    let order = await axios.get(configs.endpoint, postOptions)
        .then(res => res.data)
        .catch(error => {
            console.log(error);
            process.exit(0);
        });

    console.log(order);

    if (!order.run) {
        process.exit();
    }

    await bootTarget(); // waitInput*6 + waitTargetLoaded => 16.169 secs

    await setDateReff(order.dateReff.split('-').reverse().join('-')); // waitInput*5 => 6.17 secs

    for (let i = 1; i <= iterations; i++) {
        console.log(`#${i}`)
        await requestService(); // waitInput*6 + waitProcessed*1.5 => 142.588 secs
        await processService(order.dateReff);
        console.log('waiting...');
        await sleep(waitIteration); // ~ 8 mins
    }

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
    try {
        if (!fs.existsSync(path)) {
            // send feedback
            console.log('file not found');
            let form = { ...postOptions };
            form.data.error = true;
            await axios.post(configs.endpoint, form).finally(() => downTarget());
        }
    } catch (error) {
        console.log(error);
        downTarget();
    }

    // send output
    let form = new FormData();
    form.append('token', configs.token);
    form.append('dateReff', dateReff);
    form.append('excel', fs.readFileSync(path), 'colabs.xlsx');
    await axios
        .post(configs.endpoint, form, {
            headers: { ...form.getHeaders() }
        })
        .then(res => {
            fs.unlinkSync(path);
            console.log('upload OK.');
            if (res.data.finished) {
                downTarget();
            }
        }).catch(error => {
            console.log('upload ERROR.');
            if (fs.existsSync(path)) {
                fs.unlinkSync(path);
            }
        });
}

async function requestService() {
    await gotoConner();
    robot.moveMouse(configs.btn2.x, configs.btn2.y);
    await sleep(waitInput);
    robot.mouseClick();
    await sleep(waitProcessed);
    robot.moveMouse(configs.btn3.x, configs.btn3.y);
    await sleep(waitInput);
    robot.mouseClick();
    await sleep(parseInt(waitProcessed / 2));
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