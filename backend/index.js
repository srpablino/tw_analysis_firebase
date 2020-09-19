// Copyright 2017 Google Inc.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

const request = require('request');
const Twitter = require('twitter');
const config = require('./local.json');
const client = new Twitter({
  consumer_key: config.twitter_consumer_key,
  consumer_secret: config.twitter_consumer_secret,
  access_token_key: config.twitter_access_key,
  access_token_secret: config.twitter_access_secret
});

const gcloud = require('google-cloud')({
  keyFilename: 'keyfile.json',
  projectId: config.project_id
});

const Filter = require('bad-words'),
  filter = new Filter();

// Replace searchTerms with whatever tweets you want to stream
// Details here: https://dev.twitter.com/streaming/overview/request-parameters#track
//const aux = 'pitbull,Poodle,dalmatian,German Shepherd,Chihuahua,akita,doberman,buldog,husky';
//const aux = 'blue,grey,white,yellow,black,pink,red,green,purple,brown';
const aux = 'machine learning,big data,ai,data science,google,no sql,sql,iot,data mining';
//const aux = 'XSB,Apache Kafka,DynamoDB,Apache Hive,MongoDB,CouchBase,CouchDB,Berkeley DB,MemSQL,Redis,Memcached,MarkLogic,Cassandra,db4o,Firebase,ElasticSearch,Sphinx,Rasdaman,InfluxDB,Kdb+,Apache HBase,BaseX';
//const aux = 'mcdonalds,burgerking,pizzahut,kfc,starbucks'
//const aux = 'United States of America, Afghanistan, Albania, Algeria, Andorra, Angola, Antigua & Deps, Argentina, Armenia, Australia, Austria, Azerbaijan, Bahamas, Bahrain, Bangladesh, Barbados, Belarus, Belgium, Belize, Benin, Bhutan, Bolivia, Bosnia Herzegovina, Botswana, Brazil, Brunei, Bulgaria, Burkina, Burma, Burundi, Cambodia, Cameroon, Canada, Cape Verde, Central African Rep, Chad, Chile,Republic of China, Republic of China, Colombia, Comoros, Democratic Republic of the Congo, Republic of the Congo, Costa Rica,, Croatia, Cuba, Cyprus, Czech Republic, Danzig, Denmark, Djibouti, Dominica, Dominican Republic, East Timor, Ecuador, Egypt, El Salvador, Equatorial Guinea, Eritrea, Estonia, Ethiopia, Fiji, Finland, France, Gabon, Gaza Strip, The Gambia, Georgia, Germany, Ghana, Greece, Grenada, Guatemala, Guinea, Guinea-Bissau, Guyana, Haiti, Holy Roman Empire, Honduras, Hungary, Iceland, India, Indonesia, Iran, Iraq, Republic of Ireland, Israel, Italy, Ivory Coast, Jamaica, Japan, Jonathanland, Jordan, Kazakhstan, Kenya, Kiribati, North Korea, South Korea, Kosovo, Kuwait, Kyrgyzstan, Laos, Latvia, Lebanon, Lesotho, Liberia, Libya, Liechtenstein, Lithuania, Luxembourg, Macedonia, Madagascar, Malawi, Malaysia, Maldives, Mali, Malta, Marshall Islands, Mauritania, Mauritius, Mexico, Micronesia, Moldova, Monaco, Mongolia, Montenegro, Morocco, Mount Athos, Mozambique, Namibia, Nauru, Nepal, Newfoundland, Netherlands, New Zealand, Nicaragua, Niger, Nigeria, Norway, Oman, Ottoman Empire, Pakistan, Palau, Panama, Papua New Guinea, Paraguay, Peru, Philippines, Poland, Portugal, Prussia, Qatar, Romania, Rome, Russian Federation, Rwanda, St Kitts & Nevis, St Lucia, Saint Vincent & the, Grenadines, Samoa, San Marino, Sao Tome & Principe, Saudi Arabia, Senegal, Serbia, Seychelles, Sierra Leone, Singapore, Slovakia, Slovenia, Solomon Islands, Somalia, South Africa, Spain, Sri Lanka, Sudan, Suriname, Swaziland, Sweden, Switzerland, Syria, Tajikistan, Tanzania, Thailand, Togo, Tonga, Trinidad & Tobago, Tunisia, Turkey, Turkmenistan, Tuvalu, Uganda, Ukraine, United Arab Emirates, United Kingdom, Uruguay, Uzbekistan, Vanuatu, Vatican City, Venezuela, Vietnam, Yemen, Zambia, Zimbabwe'
const searchTerms = aux.replace(/\s/g,'').toLowerCase();
// Add a filter-level param?
client.stream('statuses/filter', {track: searchTerms, language: 'en'}, function(stream) {
  stream.on('data', function(event) {
                // Exclude tweets starting with "RT"
                //if ((event.text != undefined) && (event.text.substring(0,2) != 'RT') && (event.text === filter.clean(event.text))) {
                if ((event.text != undefined) && (event.text.substring(0,2) != 'RT')) {
					callNLApi(event);
                }
  });
  stream.on('error', function(error) {
    console.log('twitter api error: ', error);
  });
});


// INITIALIZE FIREBASE
var admin = require("firebase-admin");
var serviceAccount = require("./keyfile.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://" + config.project_id + ".firebaseio.com"
});

const db = admin.database();

db.ref('latest').remove();
db.ref('keywordData').remove();
db.ref('keywords').remove();

const tweetRef = db.ref('latest');
const keywordDataRef = db.ref('keywordData');
const keywordRef = db.ref('keywords');
const acceptedWordTypes = searchTerms.split(',');
keywordRef.set(acceptedWordTypes);

// Uses a Firebase transaction to incrememnt a counter
function incrementCount(ref, child, valToIncrement) {
  ref.child(child).transaction(function(data) {
    if (data != null) {
		data += valToIncrement;
    } else {
		data = valToIncrement;
    }
    return data;
  });
}

tweetRef.on('value', function (snap) {
    if (snap.exists()) {
      let tweet = snap.val();
      let tokens = tweet['tokens'];
        
      for (let i in tokens) {
        let token = tokens[i];
        let lema = token.lemma.replace(/\s/g,'').toLowerCase();
  
        //if ((acceptedWordTypes.indexOf(token.partOfSpeech.tag) != -1) && !(word.match(/[^A-Za-z0-9]/g))) {
        if ((acceptedWordTypes.indexOf(lema) != -1)) {
			let ref = keywordDataRef.child(lema);
			incrementCount(ref, 'totalScore', tweet.score);
			incrementCount(ref, 'numMentions', 1);
			
        }
      }
    }
});

function callNLApi(tweet) {
	    const quoted = tweet.quoted_status?tweet.quoted_status.text:'';
		const tweetText = tweet.extended_tweet?tweet.extended_tweet.full_text:tweet.full_text?tweet.full_text:tweet.text + quoted; 
		const textToSave = tweetText + " " + quoted; 
        const textUrl = "https://language.googleapis.com/v1/documents:annotateText?key=" + config.cloud_api_key;
        let requestBody = {
                "document": {
                        "type": "PLAIN_TEXT",
                        "content": textToSave
                },
                "features": {
                  "extractSyntax": true,
                  "extractEntities": true,
                  "extractDocumentSentiment": true
                }
        }

        let options = {
                url: textUrl,
                method: "POST",
                body: requestBody,
                json: true
        }

        request(options, function(err, resp, body) {
                if ((!err && resp.statusCode == 200) && (body.sentences.length != 0)) {
                        let tweetForFb = {
                          id: tweet.id_str,
                          text: textToSave,
                          user: tweet.user.screen_name,
                          user_time_zone: tweet.user.time_zone,
                          user_followers_count: tweet.user.followers_count,
                          //hashtags: tweet.entities.hashtags,
                          tokens: body.tokens,
                          score: body.documentSentiment.score,
                          magnitude: body.documentSentiment.magnitude,
                          entities: body.entities
                        };
                        tweetRef.set(tweetForFb);
                } else {
                        console.log('NL API error: ', err);
                }
        });
}
