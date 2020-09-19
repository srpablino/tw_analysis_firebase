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

// Initialize Firebase
var config = {
apiKey: "",
authDomain: "",
databaseURL: "",
projectId: "",
storageBucket: "",
messagingSenderId: ""
};
firebase.initializeApp(config);

//firebase.initializeApp(config);
const database = firebase.database();
const kwRef = database.ref('keywordData');
var keywords = [];

database.ref('keywords').on('value', function(data) {
	data.forEach(function(element){
		keywords.push(element.val());	
	});	
});

database.ref('latest').on('value', function(data) {

	let tweet = data.val();
	let currentScore = tweet.score;
	var found = [];
	var adjArr = [];

	for (let i in tweet.tokens) {
		let token = tweet.tokens[i];

		if (token.partOfSpeech.tag === "ADJ") {
		  adjArr.push(token.lemma.toLowerCase());
		}

		let lemaSearch = token.lemma.replace(/\s/g,'').toLowerCase();
		if (keywords.indexOf(lemaSearch) >= 0){
			if (found.indexOf(lemaSearch) < 0){
				found.push(lemaSearch);
			}
		}      
	}

	$('#latest-tweet').fadeOut();
	$('#latest-tweet').html('');
	$('#latest-tweet').fadeIn();
	$('#text').text(tweet.text);
	$('#keywords').text(found.join(','));
	$('#adjectives').text(adjArr.join(', '));

	// Adjust the sentiment scale for the latest tweet
	let scaleWidthPx = 400; // width of our scale in pixels
	let scaledSentiment = (scaleWidthPx * (currentScore + 1)) / 2;
	$('#current-sentiment-latest-val').css('margin-left', scaledSentiment + 'px');

});

Chart.defaults.global.defaultFontColor = '#03A9F4';
Chart.defaults.global.defaultFontStyle = 'bold';
Chart.defaults.global.defaultFontSize = 14;
Chart.defaults.global.elements.rectangle.borderColor = '#2196F3';
Chart.defaults.global.elements.rectangle.backgroundColor = '#90CAF9';
Chart.defaults.global.legend.display = false;

var chartLabels = [];
var chartData = [];
var myChart;

var htChartLabels = [];
var labelSentiments = [];
var htChart;
	  
window.onload = function (){
	
	var ctx = document.getElementById("adjChart");

  myChart = new Chart(ctx, {
      type: 'bar',
      data: {
          labels: chartLabels.reverse(),
          datasets: [{
              label: '# of mentions',
              data: chartData.reverse(),
              borderWidth: 1
          }]
      },
      options: {
          scales: {
              yAxes: [{
                  ticks: {
                      beginAtZero:true,
                      minRotation: 1,
                      autoSkip: true
                  }
              }]
          },
          title: {
            display: true,
            text: 'Most common keywords'
          },
          showTooltips: true
      }
  });

	
	  
	  
	  var scaleChart = document.getElementById("htChart");

	  htChart = new Chart(scaleChart, {
		type: 'horizontalBar',
		data: {
		  labels: htChartLabels,
		  datasets: [{
			label: 'sentiment value',
			data: labelSentiments,
			borderWidth: 1
		  }]
		},
		options: {
		  elements: {
			rectangle: {
			  borderWidth: 2
			}
		  },
		  title: {
			display: true,
			text: 'Sentiment by keywords'
		  },
		  scales: {
			xAxes: [{
			  ticks: {
				min: -1,
				max: 1
			  }
			}]
		  },
		  responsive: true
		}
	  });
	
	
	}

kwRef.orderByChild('numMentions').limitToLast(10).on('value', function(data) {
	
	  let updatedLabels = [];
      let updatedDataSentiment = [];
      let updatedDataMentions = []; 
	
	  data.forEach(function(snap) {
		let word = snap.key;
		updatedLabels.push(word);
		
		let numMentions = snap.val().numMentions;
		let sentiment = snap.val().totalScore / numMentions;
		updatedDataSentiment.push(sentiment);
		updatedDataMentions.push(numMentions)	
	  });
	  
		htChart.data.datasets[0].data = updatedDataSentiment.reverse();
		htChart.data.labels = updatedLabels.reverse();
		htChart.update();
		
		myChart.data.datasets[0].data = updatedDataMentions.reverse();
		myChart.data.labels = updatedLabels;
		myChart.update();
	  
});
