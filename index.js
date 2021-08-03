const { App, LogLevel, ExpressReceiver } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");

const express = require("express");
const ejs = require("ejs");
let sf_oper = require("./sfOperations.js");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Create a Bolt Receiver // to respond to salesforce requests
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Reading template file
const fs = require("fs");
const { AsyncLocalStorage } = require("async_hooks");
let tSlackMsg = "";
fs.readFile("./slackTemplates/msg.ejs", "utf8", (err, d) => {
  if (err) {
    console.error(err);
    return;
  }
  tSlackMsg = d;
});

let tCaseMsg = "";
fs.readFile("./slackTemplates/caseList.ejs", "utf8", (err, d) => {
  if (err) {
    console.error(err);
    return;
  }
  tCaseMsg = d;
});

let tCommentMsg = "";
fs.readFile("./slackTemplates/caseComment.ejs", "utf8", (err, d) => {
  if (err) {
    console.error(err);
    return;
  }
  tCommentMsg = d;
});

const app = new App({
  token: process.env.SLACK_ACCESS_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  logLevel: LogLevel.DEBUG,
  receiver,
});

app.command("/cstatus", async ({ command, ack, say }) => {
  try {
    await ack();
    console.log(command.text);

    if (command.text !== undefined && command.text !== "") {
      await sf_oper.sflogin(
        process.env.SF_LOGIN_URL,
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        process.env.USER_NAME,
        process.env.PASS
      );
      let c_data = await sf_oper.getCase(command.text);
      console.log(c_data);

      let caseMsg = JSON.parse(ejs.render(tCaseMsg, { data: c_data }));

      if (c_data.length > 0) {
        (async () => {
          try {
            say(caseMsg);
          } catch (err) {
            console.log(err);
          }
        })();
      }
    }

    //say("Yaaay! that command works!");
  } catch (error) {
    console.error(error);
  }
});

// to respond to case ownership 
app.command("/cowner", async ({ command, ack, say }) => {
  try {
    await ack();

    await sf_oper.sflogin(
      process.env.SF_LOGIN_URL,
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      process.env.USER_NAME,
      process.env.PASS
    );
    let c_data = await sf_oper.getCasesByOwner(process.env.CASE_OWNER_ID);
    console.log(c_data);

    let caseMsg = JSON.parse(ejs.render(tCaseMsg, { data: c_data }));

    if (c_data.length > 0) {
      (async () => {
        try {
          say(caseMsg);
        } catch (err) {
          console.log(err);
        }
      })();
    }
  } catch (error) {
    console.error(error);
  }
});

// to respond to different case actions
app.action(/case_actions.*/, async ({ body, ack, say, client }) => {
  ack();
  try {
    const option = body.actions[0].selected_option.text.text;
    const param = body.actions[0].selected_option.value.split("|");

    console.log(body.actions[0].selected_option);

    let commentMsg = JSON.parse(
      ejs.render(tCommentMsg, { data: { CaseNumber: param[1], Id: param[0] } })
    );

    /*if(option === "close case"){    
        await sf_oper.sflogin(
            process.env.SF_LOGIN_URL,
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET,
            process.env.USER_NAME,
            process.env.PASS
        );
            
        const res = await sf_oper.closeCase(param[0]);
        
        console.log(param[1]);
        
        if(res === true){
            say(`*Case No.* <${param[1]}> closed.`);
            return;
        }
        
        say("failed to close case.");
    }
    else if(option === "add comment"){*/
    const res = await client.views.open({
      trigger_id: body.trigger_id,
      // View Payload
      view: commentMsg,
    });
    console.log(res);
  } catch (err) {
    console.log(err);
  }
});

// to respond to take ownership action
app.action("take_ownership", async ({ body, ack, say, client }) => {
  ack();
  say("*" + body.user.name + "* took ownership of the case.");
});

// to respond to case comment request
app.view("comment_view", async ({ ack, body, view, client, say }) => {
  await ack();
  try {
    let cComm =
      view["state"]["values"]["comment_input"]["case_comment_action"].value;
    let cNo = view.blocks[0].text.text
      .substring(11, view.blocks[0].text.text.length)
      .trim();
    console.log(cNo);

    //adding comment to case in Salesforce
    await sf_oper.sflogin(
      process.env.SF_LOGIN_URL,
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      process.env.USER_NAME,
      process.env.PASS
    );

    let result = await sf_oper.addCaseComment(cNo, cComm);
    if (result) {
      console.log("Case comment added.");
      // Todo add a success message
    } else {
      console.log("failed to add case comment.");
    }
  } catch (err) {
    console.log(err);
    console.log("failed to add case comment.");
  }
});

// respond to call from salesforce
receiver.router.get("/new-case", async (req, res) => {
  // You're working with an express req and res now.
  const caseId = req.query["caseid"];

  if (caseId === undefined || caseId === "") {
    res.send("Case Id is missing");
    return;
  }

  const web = new WebClient(process.env.SLACK_ACCESS_TOKEN);

  await sf_oper.sflogin(
    process.env.SF_LOGIN_URL,
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.USER_NAME,
    process.env.PASS
  );

  const c_data = await sf_oper.getCaseDetailsById(caseId);
  console.log(c_data);

  const slackMsg = JSON.parse(ejs.render(tSlackMsg, { v: c_data[0] }));

  console.log(slackMsg);

  (async () => {
    try {
      // Use the `chat.postMessage` method to send a message from this app
      await web.chat.postMessage({
        channel: "#integration",
        text: `New Case No.: ${c_data[0].CaseNumber}`,
        blocks: slackMsg,
      });
    } catch (error) {
      console.log(error);
    }

    console.log("Message posted!");
  })();

  res.send("yes");
});

// Staring app
(async () => {
  await app.start(process.env.PORT);
  console.log("⚡️ Bolt app is running!");
})();
