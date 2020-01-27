//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const encrypt = require("mongoose-encryption");

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');

// Use the urlencoded option to access values sent in forms,
// extended true means you can post nested objects??
app.use(bodyParser.urlencoded({
  extended: true
}));

mongoose.connect("mongodb://localhost:27017/userDB", {
  useUnifiedTopology: true,
  useNewUrlParser: true
});

// To use encryption we have to use mongoose.Schema
// This simple way of using just a js object for schema works if you're not
// doing anything fancy with them.
const userSchema = new mongoose.Schema({
  email: String,
  password: String
});

// Our secret string to help encrypt passwords. We put this in our .env file now.
// We use .env to prevent accidentally exposing sensitive info on github.
// const secret = "Thisisourlittlesecret.";

// add encrypt package and our secret as a plugin to schema
// however doing this will encrypt the entire schema when we only want to encrypt the password.
// To do this we have to specify the fields we want to encrypt w/ "encryptedFields"
// This will encrypt when you call save data and automatically decrypt when getting the data.
// All of this is done behind the scenes
userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ["password"]});

const User = new mongoose.model("User", userSchema);

app.get("/", function(req, res) {
  res.render("home"); //home.ejs
});

app.get("/login", function(req, res) {
  res.render("login"); //login.ejs
});

app.get("/register", function(req, res) {
  res.render("register"); //register.ejs
});

app.post("/register", function(req, res) {
  const newUser = new User({
    email: req.body.username,
    password: req.body.password
  });

  newUser.save(function(err){
    if(err){
      console.log(err);
    }else{
      res.render("secrets");
    }
  });
});

app.post("/login", function(req, res) {
  const username = req.body.username;
  const password = req.body.password;

  User.findOne({email: username}, function(err, foundUser){
    if(err){
      console.log(err);
    }else{
      if(foundUser){
        if(foundUser.password === password){
          res.render("secrets");
        }
      }
    }
  });
});

app.listen(3000, function() {
  console.log("Server started on 3000");
});
