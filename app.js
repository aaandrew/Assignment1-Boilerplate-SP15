//dependencies for each module used
var express = require('express');
var passport = require('passport');
var InstagramStrategy = require('passport-instagram').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var http = require('http');
var path = require('path');
var handlebars = require('express-handlebars');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var dotenv = require('dotenv');
var Instagram = require('instagram-node-lib');
var mongoose = require('mongoose');
var graph = require('fbgraph');
var drake = require('./DrakeAlg');
var app = express();

//local dependencies
var models = require('./models');

//client id and client secret here, taken from .env
dotenv.load();
var INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID;
var INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET;
var INSTAGRAM_CALLBACK_URL = process.env.INSTAGRAM_CALLBACK_URL;
var INSTAGRAM_ACCESS_TOKEN = "";
var FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
var FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
var FACEBOOK_CALLBACK_URL = process.env.FACEBOOK_CALLBACK_URL;
Instagram.set('client_id', INSTAGRAM_CLIENT_ID);
Instagram.set('client_secret', INSTAGRAM_CLIENT_SECRET);

//connect to database
mongoose.connect(process.env.MONGODB_CONNECTION_URL);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
  console.log("Database connected succesfully.");
});

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Instagram profile is
//   serialized and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the InstagramStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Instagram
//   profile), and invoke a callback with a user object.
passport.use(new InstagramStrategy({
    clientID: INSTAGRAM_CLIENT_ID,
    clientSecret: INSTAGRAM_CLIENT_SECRET,
    callbackURL: INSTAGRAM_CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    models.User.findOne({
      "id": profile.id,
    }, function(err, user) {
      if(user){
        user.access_token = accessToken;
        user.save(function(err){
          if(err) throw err;
          process.nextTick(function () {
            return done(null, profile);
          });
        });
      }else{
        var instance = new models.User();
        instance.id = profile.id;
        instance.access_token = accessToken;
        instance.name = profile.username;
        instance.save(function (err) {
          if(err) throw err;
          process.nextTick(function () {
            return done(null, profile);
          });
        });
      }
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: FACEBOOK_APP_ID,
    clientSecret: FACEBOOK_APP_SECRET,
    callbackURL: FACEBOOK_CALLBACK_URL,
    enableProof: false
  },
  function(accessToken, refreshToken, profile, done) {
    graph.setAccessToken(accessToken);
    graph.setAppSecret(FACEBOOK_APP_SECRET);
    models.User.findOne({
      "id": profile.id,
    }, function(err, user) {
      if(user){
        user.access_token = accessToken;
        user.save(function(err){
          if(err) throw err;
          process.nextTick(function () {
            return done(null, profile);
          });
        });
      }else{
        var instance = new models.User();
        instance.id = profile.id;
        instance.access_token = accessToken;
        instance.name = profile.displayName;
        instance.save(function (err) {
          if(err) throw err;
          process.nextTick(function () {
            return done(null, profile);
          });
        });
      }
    });
  }
));


//Configures the Template engine
app.engine('handlebars', handlebars({defaultLayout: 'layout'}));
app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views');
app.use(express.static(path.join(__dirname, 'public')));
app.use('/bower_components',  express.static(__dirname + '/bower_components'));
app.use('/assets',  express.static(__dirname + '/assets'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({ secret: 'keyboard cat',
                  saveUninitialized: true,
                  resave: true}));
app.use(passport.initialize());
app.use(passport.session());

//set environment ports and start application
app.set('port', process.env.PORT || 3000);

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { 
    return next(); 
  }
  res.redirect('/login');
}

//routes
app.get('/', function(req, res){
  res.render('login');
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', {user: req.user});
});

app.get('/privacypolicy', function(req, res){
  res.render('privacypolicy');
});

app.get('/facebookaccount', ensureAuthenticated, function(req, res){
  var options = {
    timeout:  3000,
    pool: { maxSockets:  Infinity },
    headers: { connection: "keep-alive" }
  }
  var params = { fields: "message,from,full_picture", limit: 30 };
  graph.setOptions(options).get("me/feed", params, function(err, resp) {
    var ret = {posts:[]};
    var data = [];
    var d = resp['data'];
    var emotions = drake.getEmotions();
    for(var i in d){
      if(d[i].message && d[i].full_picture){
        ret.posts.push({
          'picture': d[i].full_picture,
          'message': d[i].message,
          'author': d[i].from.name,
          'emotion': emotions[i],
          'id': i
        });
      }else if(d[i].message){
        data.push(d[i].message);
        ret.posts.push({
          'message': d[i].message,
          'emotion': emotions[i],
          'author': d[i].from.name,
          'id': i
        });
      }
    }
    var song = drake.findSong(data);
    song['song'] = song['song'].toLowerCase();
    res.render('facebookaccount', {song: song, user:req.user, data:ret});
  });
});

app.get('/photos', ensureAuthenticated, function(req, res){
  var query  = models.User.where({ name: req.user.username });
  query.findOne(function (err, user) {
    if (err) return handleError(err);
    if (user) {
      // doc may be null if no document matched
      var d = [];
      Instagram.users.self({
        access_token: user.access_token,
        complete: function(data) {
          //Map will iterate through the returned data obj
          var id = 0;
          var emotions = drake.getEmotions();
          var imageArr = data.map(function(item) {
            //create temporary json object
            tempJSON = {};
            tempJSON.url = item.images.low_resolution.url;
            tempJSON.caption = item.caption.text;
            tempJSON.author = (item.caption.from.full_name.length == 0)? item.caption.from_full_name : item.caption.from.username;
            tempJSON.id = id;
            tempJSON.emotion = emotions[id];
            id++;
            d.push(tempJSON.caption);
            //insert json object into image array
            return tempJSON;
          });
          var song = drake.findSong(d);
          song['song'] = song['song'].toLowerCase();
          res.render('photos', {song: song, user:req.user.username, photos: imageArr});
        }
      }); 
    }
  });
});

// GET /auth/instagram
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Instagram authentication will involve
//   redirecting the user to instagram.com.  After authorization, Instagram
//   will redirect the user back to this application at /auth/instagram/callback
app.get('/auth/instagram',
  passport.authenticate('instagram'),
  function(req, res){
    // The request will be redirected to Instagram for authentication, so this
    // function will not be called.
  });

// GET /auth/instagram/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/instagram/callback', 
  passport.authenticate('instagram', { failureRedirect: '/login'}),
  function(req, res) {
    res.redirect('/photos');
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.get('/auth/facebook',
  passport.authenticate('facebook', { scope: ['user_posts'] }));

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/facebookaccount');
  });

http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
