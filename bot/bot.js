var Botkit = require('botkit')
var Table = require('easy-table')
var github = require("./gitinterface.js");
var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');

const {Wit, log} = require('node-wit');

const client = new Wit({accessToken: process.env.wit});

var clientId = process.env.CIBOTCID;
var clientSecret = process.env.CIBOTCSEC;

var adminlist = ["U6WCFDZL3", "U6WGAURSQ","U6VUKPYCR","U7USQD4SY","U7C5SDE5Q"];

var app = express();
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());

const PORT=4390;

app.listen(PORT, function () {
    //Callback triggered when server is successfully listening.
    console.log("CiBot app listening on port " + PORT);
});

if (!process.env.wit) {
    console.log('Error: Specify wit in environment');
    process.exit(1);
}
 
if (process.env.SLACKTOKEN) {
	console.log("This is the slacktoken set-" + process.env.SLACKTOKEN);
}

if (!process.env.SLACKTOKEN) {
	console.log('Error: Specify the Slack bot token in environment variable: SLACKTOKEN');
	process.exit(1);
}

var controller = Botkit.slackbot({
	debug : false
});

// connect the bot to a stream of messages
var bot = controller.spawn({
	token : process.env.SLACKTOKEN
}).startRTM()

var wit = require('botkit-middleware-witai')({
    token: process.env.wit,
});


controller.configureSlackApp({
  clientId: clientId,//clientid
  clientSecret: clientSecret,//clientsecret
  redirectUri: 'http://54.209.205.158:4390/oauth',//oauth
  scopes: ['incoming-webhook','team:read','users:read','channels:read','im:read','im:write','groups:read','emoji:read','chat:write:bot']
});

app.get('/', function(req, res) {
    res.send('Ci Bot Service is working! Your Path: ' + req.url);
});

app.get('/oauth', function(req, res) {
    // When a user authorizes an app, a code query parameter is passed on the oAuth endpoint. If that code is not there, we respond with an error message
    if (!req.query.code) {
        res.status(500);
        res.send({"Error": "Looks like we're not getting code."});
        console.log("Looks like we're not getting code.");
    } else {
        // We'll do a GET call to Slack's `oauth.access` endpoint, passing our app's client ID, client secret, and the code we just got as query parameters.
        request({
            url: 'https://slack.com/api/oauth.access', //URL to hit
            qs: {code: req.query.code, client_id: clientId, client_secret: clientSecret}, //Query string data
            method: 'GET', //Specify the method

        }, function (error, response, body) {
            if (error) {
                console.log(error);
            } else {
                res.json(body);
            }
        })
    }
});

// This method is used to create the dynamic options to load in the list PR request.
app.post('/proptions', function(req, res) {
	console.log('Loading options for the dynamic menu');
	var repo = "SEGitAPI";
	var owner = "srivassumit";
	github.getPullRequests(owner, repo, (value) => {
		console.log('Bot: Received ' + value.length + ' Pull requests');
		var options = {};
		var key = 'options';
		options[key] = [];
		var details;
		details= owner;
		details=details+" "+repo;
		for(i=0;i<value.length;i++){
			//details2 = value[i].number;
			var data = {
				text: '#' + value[i].number + ': ' + value[i].title,
				value: details + " " + value[i].number
			};
			// console.log('-->>>>> The Value of PR: ' + JSON.stringify(value[i]));
			options[key].push(data);
		}
		console.log('Pull Requests options are: ' + JSON.stringify(options));
		res.type('json');
		res.send(options);
	});	
});

// Functionality of List PRs... apart fromt he normal conversations, the user also has an option to use this slash command.
app.post('/listprs', function(req, res) {
	console.log('generating dynamic pr list');
	var repo = "SEGitAPI"
	var owner = "srivassumit"
	var reply_with_attachments = {
		"text": "Select a Pull Request from the List:",
		"attachments": [{
			"text": "Pull Requests of repository: " + repo,
			"fallback": "Upgrade your Slack client to use message menus.",
			"color": "#3AA3E3",
			"attachment_type": "default",
			"callback_id":"pr_selection",
			"actions": [{
			  "name": "prnames",
			  "text": "Select a pull request",
			  "type": "select",
			  "data_source": "external",
			}]
		}]
	};
	res.send(reply_with_attachments);
});

// This method is used to respond to the actions whenever a user selects any option from a menu or clicks on a button.
// The callback contains the action Name which can be used to determine which action was performed.
app.post('/actions', function(req, res) {
	console.log('Inside action response: ');	
	var reqPayload = req.body.payload;
	console.log(reqPayload);
	//parse the name of the action
	var userName = JSON.parse(reqPayload).user.id;
	var actionName = JSON.parse(reqPayload).actions[0].name;
	var actionValue = JSON.parse(reqPayload).actions[0].value;
	console.log('actionName:' + actionName);
	console.log('actionValue:' + actionValue);
	//res.type('json');
	if (actionName == 'merge') {
		// The merge button is clicked.
		console.log('The Merge button was clicked');
		var values = actionValue.split("$#");//<repo>$#<owner>$#<number>$#<headbranch>
		var repo = values[0];
		var owner = values[1];
		var prnumber = values[2];
		var branch = values[3];
		var user = userName
		doMergeAction(repo, owner, prnumber, branch,user,function(response){
			res.send(response);	
		});
		//res.send("you clicked merge button!");
	} else if (actionName == 'nomerge') {
		// The Dont't merge button is clicked
		console.log('The Don\'t Merge button was clicked');		
		res.send("Thanks for reducing my work. Appreciate it!");
	} else if (actionName == 'prnames') {
		// an option is selected from the dynamic dropdown list.
		console.log('An option was selected fromt the Dynamic drop down list of List pull requests.');
		console.log('The request Payload is: ' + reqPayload);
		var selectedOptionValue = JSON.parse(reqPayload).actions[0].selected_options[0].value;
		console.log(selectedOptionValue); // This is the PR number

		//extract things from selectedOptionValue
		var arr = selectedOptionValue.split(" ")
		console.log('Got this: ' +arr);//<owner> <repo> <number>
		github.getPullRequest(arr[0], arr[1], arr[2], (value) => {
			console.log(value)
			var headBranch = value.head.label.split(":")[1];
			var baseBranch = value.base.label.split(":")[1];
			//console.log('HEAD: ' + headBranch + ', BASE: ' + baseBranch);
			var val = value.head.repo.name + "$#" + value.user.login + "$#" + value.number + "$#" + headBranch + "$#" + baseBranch;
			var msg = "Pull Request Details: \nId: " + value.id + "\nTitle: " +value.title + "\nDescription: " + value.body;
			var reply_with_attachments = {
				"text": msg,
				"attachments": [
					{
						"text": "Would you like to merge this PR",
						"fallback": "You are unable to choose an option",
						"callback_id": "merge_action",
						"color": "#09aa08",
						"attachment_type": "default",
						"actions": [
							{
								"name": "merge",
								"text": "Merge",
								"style":"primary",
								"type": "button",
								"value": val
							},
							{
								"name": "nomerge",
								"text": "Don't Merge",
								"style":"danger",
								"type": "button",
								"value": "nomerge"
							}
						]
					}
				]
			}
			res.type('json');
			res.send(reply_with_attachments);
		});
	} else {
		res.send("New uknown action received: " + actionName);
	}
});



// Get the list of pull requests for a given repository. Alternately the slash command /listprs can also be used.
controller.hears(/\b.*\b/,['mention', 'direct_mention','direct_message'], function(bot,message) {
	console.log(message.match[0])
    client.message(message.match)
 .then((data) => {
   console.log(JSON.stringify(data));
   var intent = (data.entities.intent[0].value)
   var repo1 = (data.entities.repo_name[0].value)
   
   if(intent.toString() == "merge_pull_req"){
	 //  console.log("Insiade")
		var number = (data.entities.number[0].value)
		console.log(repo1)
		var owner = repo1.split('/')[1]
		var repo =  repo1.split('/')[0]
		console.log(repo,owner,number)
		 github.getPullRequest(owner, repo, number, (value) => {
		 console.log(value);
		var headBranch = value.head.label.split(":")[1];
		var baseBranch = value.base.label.split(":")[1];
		 //console.log('HEAD: ' + headBranch + ', BASE: ' + baseBranch);
		 var val = value.head.repo.name + "$#" + value.user.login + "$#" + value.number + "$#" + headBranch + "$#" + baseBranch;
		 var reply_with_attachments = {
			 "text": "Would you like to merge this PR?",
			 "attachments": [
				 {
					 "text": "Choose an option",
					 "fallback": "You are unable to choose an option",
					 "callback_id": "merge_action",
					 "color": "#09aa08",
					 "attachment_type": "default",
					 "actions": [
						 {
							 "name": "merge",
							 "text": "Merge",
							 "style":"primary",
							 "type": "button",
							 "value": val
						 },
						 {
							 "name": "nomerge",
							 "text": "Don't Merge",
							 "style":"danger",
							 "type": "button",
							 "value": "nomerge"
								 }
				 ]
				 }
			 ]
		 }
		 bot.reply(message, reply_with_attachments);    	
	 });

   }
   else if(intent=="list_pull_reqs"){
	   console.log(repo1)
	   var repo = repo1.split('/')[0]
	    var reply_with_attachments = {
		 "text": "Select a Pull Request from the List:",
		 "attachments": [{
			 "text": "Pull Requests of repository: " + repo,
			 "fallback": "Upgrade your Slack client to use message menus.",
			 "color": "#3AA3E3",
			 "attachment_type": "default",
			 "callback_id":"pr_selection",
			 "actions": [{
			   "name": "prnames",
			   "text": "Select a pull request",
			   "type": "select",
			   "data_source": "external",
			 }]
		 }]
	 };
	 bot.reply(message, reply_with_attachments);
   }
   else if(intent=="issue_pull_req"){
	   // var text_message = message.text
	// var responseMsg = "successfully issued " + text_message.toString().split("issue").pop();

	 var repo = repo1.split('/')[0]
	 var owner = repo1.split('/')[1]
	 var branchName = data.entities.from[0].value
	 var base = data.entities.to[0].value
	 github.createPullRequest(owner, repo, branchName, base, (value) => {
		 if (value){
			 console.log("Pull Request created")
			 bot.reply(message, responseMsg);
		 } else {
			 console.log("unable to create pull request.")
			 bot.reply(message, "Unable to create pull request.");
		 }
   });
 }
})})

// // Get the list of pull requests for a given repository. Alternately the slash command /listprs can also be used.
// controller.hears(/\bget.*requests.*\b/,['mention', 'direct_mention','direct_message'], function(bot,message) {
	// // user says: Get pull requests for octocat for repo Hello-World
	// var repo = "SEGitAPI"
	// var owner = "srivassumit"
	// console.log('generating dynamic pr list');
	// var reply_with_attachments = {
		// "text": "Select a Pull Request from the List:",
		// "attachments": [{
			// "text": "Pull Requests of repository: " + repo,
			// "fallback": "Upgrade your Slack client to use message menus.",
			// "color": "#3AA3E3",
			// "attachment_type": "default",
			// "callback_id":"pr_selection",
			// "actions": [{
			  // "name": "prnames",
			  // "text": "Select a pull request",
			  // "type": "select",
			  // "data_source": "external",
			// }]
		// }]
	// };
	// bot.reply(message, reply_with_attachments);
// });


// // Get the details of a given pull request.
// controller.hears(/\bget.*request.*\b/,['mention', 'direct_mention','direct_message'], function(bot,message) {
	// // let the bot say: Get pull request 1 for octat for repo Hello-World
	// var repo = "SEGitAPI" // extract this from user message/intent/context?
	// var owner = "srivassumit" // extract this from user message/intent/context?
	// var number = 13 // extract this from user message/intent/context?
	// github.getPullRequest(owner, repo, number, (value) => {
		// console.log(value);
		// var headBranch = value.head.label.split(":")[1];
		// var baseBranch = value.base.label.split(":")[1];
		// console.log('HEAD: ' + headBranch + ', BASE: ' + baseBranch);
		// var t ="Id: " + value.number + "\nTitle: " + value.title + "\nDescription: " + value.body + "\nHEAD Branch: " + headBranch;
    	// bot.reply(message, t.toString());
	// });

// });

// // merge a given pull request. Alternately the slash command /mergepr can also be used.
// //@botCiCd merge #1 pull request for aakarshg/serverprovision
// controller.hears(/\bmerge.*\b/, [ 'mention', 'direct_mention', 'direct_message' ], function(bot, message) {
	// console.log('inside merge method hear');
	// var repo = "SEGitAPI"; // extract this from user message/intent/context?
	// var owner = "srivassumit" // extract this from user message/intent/context?
	// var number = 15; // extract this from user message/intent/context?

	 // github.getPullRequest(owner, repo, number, (value) => {
		 // console.log(value);
		 // var headBranch = value.head.label.split(":")[1];
		// var baseBranch = value.base.label.split(":")[1];
		 // //console.log('HEAD: ' + headBranch + ', BASE: ' + baseBranch);
		 // var val = value.head.repo.name + "$#" + value.user.login + "$#" + value.number + "$#" + headBranch + "$#" + baseBranch;
		 // var reply_with_attachments = {
			 // "text": "Would you like to merge this PR?",
			 // "attachments": [
				 // {
					 // "text": "Choose an option",
					 // "fallback": "You are unable to choose an option",
					 // "callback_id": "merge_action",
					 // "color": "#09aa08",
					 // "attachment_type": "default",
					 // "actions": [
						 // {
							 // "name": "merge",
							 // "text": "Merge",
							 // "style":"primary",
							 // "type": "button",
							 // "value": val
						 // },
						 // {
							 // "name": "nomerge",
							 // "text": "Don't Merge",
							 // "style":"danger",
							 // "type": "button",
							 // "value": "nomerge"
								 // }
				 // ]
				 // }
			 // ]
		 // }
		 // bot.reply(message, reply_with_attachments);    	
	 // });

	
// });

// // Getting the details from jenkins and this is where bot is supposed to hit git's rest api to get all details.
// controller.hears(/\bsample.*Pull.*request.*submitted\b/,['mention', 'direct_mention','direct_message'], function(bot,message) {
	// console.log("Got the message");
	// bot.say({text: "[sample/samplerepo] Pull request submitted by dummy #9 DummyPRTitle", channel: 'selenium-test'});
// });


 function doMergeAction(repo, owner, prnumber, branch, user, callback) {
	 console.log('inside do merge action');
	 var reply = '';
	 //check admin list before actually merging
	 if(adminlist.indexOf(user) > -1) {
		// // github.getStatus(owner, repo, branch, (out) =>{
		// // 	if(out)	{
				 github.mergePullRequest(owner, repo, prnumber, (msg) => {
					 if (msg) {
						 console.log('msg received in bot: ' + msg)
						 reply = msg;
						 return callback(reply);
					 }
				 });
			// // } else {
			// // 	reply = "Build has been unsuccessful";
			// // 	return callback(reply);
			// // }
		// // });
	 } else {
		 reply = "You don't have permission to merge via the bot interface!";
		 console.log(reply);
		 return callback(reply);
	 }
 };