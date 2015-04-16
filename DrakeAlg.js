var songs = require('./Songs').songs;
var phrases = require('./Songs').phrases;

var self = {
	findSong: function (data) {
		var sum = 0;
		for(var i in data){
			if(data[i]){
				sum += data[i].split(' ').length;
			}
		}
		var emotionslevel = self.mapEmotions(sum/data.length);
		var index = parseInt(Math.random() * songs[emotionslevel-1].titles.length);
		var ret = {};
		ret['song'] = songs[emotionslevel-1].titles[index].title;
		ret['text'] = songs[emotionslevel-1].text;
		return ret;
	},

	mapEmotions: function(avg){
		if(avg <= 5)
			return parseInt(Math.random()*3) + 1;
		else if(avg <= 10)
			return parseInt(Math.random()*3) + 3;
		else if(avg <= 15)
			return parseInt(Math.random()*3) + 5;
		else if(avg <= 20)
			return parseInt(Math.random()*3) + 7;
		else if(avg > 20)
			return parseInt(Math.random()*2) + 9;
	},
	getEmotions: function(){
		var emotions = [];
		for(var i=0; i<50; i++){
			emotions.push(phrases[parseInt(Math.random()*phrases.length)]);
		}
		return emotions;
	}
};

module.exports = self;