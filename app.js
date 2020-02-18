//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
// const encrypt = require("mongoose-encryption"); // level 2 encryption
// const md5 = require("md5"); // level 3 hashing
// const bcrypt = require("bcrypt");
// const saltRounds = 10;

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');

// Use the urlencoded option to access values sent in forms,
// extended true means you can post nested objects??
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "This is my big fat secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


mongoose.connect("mongodb://localhost:27017/userDB", {
  useUnifiedTopology: true,
  useNewUrlParser: true
});

// There was a warning when running passport w/ mongoose. Set this to fix it.
mongoose.set("useCreateIndex", true);

// To use encryption we have to use mongoose.Schema
// This simple way of using just a js object for schema works if you're not
// doing anything fancy with them.
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String
});

userSchema.plugin(passportLocalMongoose); // helps us hash + salt pws, were not using bcrypt
userSchema.plugin(findOrCreate);

// Our secret string to help encrypt passwords. We put this in our .env file now.
// We use .env to prevent accidentally exposing sensitive info on github.
// const secret = "Thisisourlittlesecret.";

// add encrypt package and our secret as a plugin to schema
// however doing this will encrypt the entire schema when we only want to encrypt the password.
// To do this we have to specify the fields we want to encrypt w/ "encryptedFields"
// This will encrypt when you call save data and automatically decrypt when getting the data.
// All of this is done behind the scenes
// userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ["password"]});

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy()); // use local strategy to authenitcate username/pw (i dunno..)
passport.serializeUser(function(user, done) { // Creates fortune cookie w/ a msg
  done(null, user.id);
});

passport.deserializeUser(function(id, done) { // Opens fortune cookie and see msg.
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

// Don't use this way as this only works for local strategy, whereas the one on top works with all.
// passport.serializeUser(User.serializeUser()); // Creates fortune cookie w/ a msg
// passport.deserializeUser(User.deserializeUser()); // Opens fortune cookie and see msg.

// Google+ is gone so retrieve info from userProfileURL->userInfo
// Need to create an app on Google Dev Console and create CLIENT_ID and CLIENT_SECRET for oauth.
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res) {
  res.render("home"); //home.ejs
});

// Passport will authenitcate using the google strategy as defined above
// Initiate authenitication on google servers asking for user's profile.
app.get("/auth/google",
  passport.authenticate("google", {
    scope: ["profile"]
  }));

// Once user has signed in to google they will be redirected here.
// Authenitcate them locally and save their login session
app.get("/auth/google/secrets",
  passport.authenticate("google", {
    failureRedirect: "/login"
  }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  });

app.get("/login", function(req, res) {
  res.render("login"); //login.ejs
});

app.get("/register", function(req, res) {
  res.render("register"); //register.ejs
});

app.get("/secrets", function(req, res) {
  User.find({"secret": {$ne: null}}, function(err, foundUsers){
    if(err){
      console.log(err);
    }else{
      if(foundUsers){
        res.render("secrets", {usersWithSecrets: foundUsers});
      }
    }
  })
});

app.get("/submit", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", function(req, res) {
  const secret = req.body.secret;

  // find the user who submitted the userDB
  // passport will save the user details in the request variable
  User.findById(req.user.id, function(err, foundUser) {
    if (err) {

    } else {
      if (foundUser) {
        foundUser.secret = secret;

        foundUser.save(function() {
          res.redirect("/secrets")
        });
      }
    }
  });
});

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

app.post("/register", function(req, res) {
  // Instead of creating a new user and then saving the user
  // passport-local-mongoose register method takes care of that for us.
  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        // If authentication succeeds and successfully created a cookie
        // Users can directly go to /secrets page cause they have the loggedin cookie.
        res.redirect("/secrets");
      });
    }
  });
});

app.post("/login", function(req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function() {
        // If authentication succeeds and successfully created a cookie
        // Users can directly go to /secrets page cause they have the loggedin cookie.
        res.redirect("/secrets");
      });
    }
  });
});

app.listen(3000, function() {
  console.log("Server started on 3000");
});
