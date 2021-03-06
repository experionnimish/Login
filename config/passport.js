// config/passport.js

// load all the things we need
var LocalStrategy   = require('passport-local').Strategy;
var md5 = require('md5');
// load up the user model
var mysql = require('mysql');
var bcrypt = require('bcrypt-nodejs');
var dbconfig = require('./database');
var connection = mysql.createConnection(dbconfig.connection);

connection.query('USE ' + dbconfig.database);
// expose this function to our app using module.exports
module.exports = function(passport) {

    // =========================================================================
    // passport session setup ==================================================
    // =========================================================================
    // required for persistent login sessions
    // passport needs ability to serialize and unserialize users out of session

    // used to serialize the user for the session
    passport.serializeUser(function(user, done) {
        done(null, user.id);
        console.log(user.id);
    });

    // used to deserialize the user
    passport.deserializeUser(function(id, done) {
        connection.query("SELECT * FROM users WHERE id = ? ",[id], function(err, rows){
            done(err, rows[0]);
        });
    });

    // =========================================================================
    // LOCAL SIGNUP ============================================================
    // =========================================================================
    // we are using named strategies since we have one for login and one for signup
    // by default, if there was no name, it would just be called 'local'


    passport.use(
        'local-login',
        new LocalStrategy({
            // by default, local strategy uses username and password, we will override with email
            usernameField : 'username',
            passwordField : 'password',
            passReqToCallback : true // allows us to pass back the entire request to the callback
        },
        function(req, username, password, done) { // callback with email and password from our form
          req.assert('username').notEmpty().isLength(3).isInt();
          req.assert('password').notEmpty().isLength(6,50);
          var errors = req.validationErrors();
  		    if( !errors) {
            console.log("No validation errors");
            connection.query("SELECT * FROM users WHERE employee_id = ?",[username], function(err, rows){
                if (err)
                    return done(err);
                if (!rows.length) {
                    return done(null, false, req.flash('loginMessage', 'No user found!')); // req.flash is the way to set flashdata using connect-flash
                }
                // if the user is found but the password is wrong
                if (md5(password) != rows[0].password)
                    return done(null, false, req.flash('loginMessage', 'Incorrect password!')); // create the loginMessage and save it to session as flashdata
                if (rows[0].flag != 1)
                    return done(null, false, req.flash('loginMessage', 'Your account has been disabled!'));
                // all is well, return successful user
                return done(null, rows[0]);
            });
          }
          else {
            console.log("Login failed");
            return done(null, false, req.flash('loginMessage', 'Invalid input!'));
          }
        })
    );
};
