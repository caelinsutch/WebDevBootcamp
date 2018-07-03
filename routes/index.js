var Campground = require("../models/campground")

var express = require('express');
var router = express.Router();
var passport = require("passport");
var User = require("../models/user");
var Campground = require("../models/campground");
var async = require("async");
var nodemailer = require("nodemailer");
var crypto = require("crypto");

//Route
router.get("/", function(req, res){
    res.render("landing");
});

// show register form
router.get("/register", function(req, res){
   res.render("register"); 
});
//handle sign up logic
router.post("/register", function(req, res){
    var newUser = new User(
        {
            username: req.body.username, 
            firstName: req.body.firstname, 
            lastName: req.body.lastName,
            email: req.body.email,
            avatar: req.body.avatar
        });
    if(req.body.adminCode === 'YelpCampAdmin') {
        newUser.isAdmin = true;
    }
    User.register(newUser, req.body.password, function(err, user){
        if(err){
            console.log(err.message);
            req.flash("error", err.message);
            return res.redirect("register");
        }
        passport.authenticate("local")(req, res, function(){
            req.flash("success", "Welcome to YelpCamp " + user.username);
           res.redirect("/campgrounds"); 
        });
    });
});

// show login form
router.get("/login", function(req, res){
   res.render("login"); 
});
// handling login logic
router.post("/login", function(req, res, next) {
    passport.authenticate("local", 
    {
        successRedirect: "/campgrounds",
        failureRedirect: "/login",
        failureFlash: true,
        successFlash: "Welcome to YelpCamp " + req.body.username + "!"
    })(req, res);
});

// logout route
router.get("/logout", function(req, res){
   req.logout();
   req.flash("success", "Logged You Out!");
   console.log("Logged Out")
   res.redirect("/campgrounds");
});

//Reset Password
router.get('/forgot', function(req, res){
    res.render('forgot')
})

router.post("/forgot", function(req, res, next){
    async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email }, function(err, user) {
        if (!user || err) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: 'caelinsutch@gmail.com',
          pass: process.env.GMAIL
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'caelinsutch@gmail.com',
        subject: 'Node.js Password Reset',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        console.log('mail sent');
        req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
        done(err, 'done');
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/forgot');
  });
});

//Reset Token Route

router.get('/reset/:token', function(req, res){
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user || err) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    res.render('reset', {token: req.params.token});
  });
})

router.post('/reset/:token', function(req, res){
    async.waterfall([
        function(done) {
            User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: {$gt: Date.now()}}, function(err, user) {
                if (!user || err) {
                  req.flash('error', 'Password reset token is invalid or has expired.');
                  return res.redirect('back')
                }
                if(req.body.password === req.body.confirm) {
                    user.setPassword(req.body.password, function(err) {
                        if (err) {
                            req.flash("error", "Something went wrong")
                            res.redirect("/campgrounds")
                        }
                        user.resetPasswordToken = undefined;
                        user.resetPasswordExpires = undefined;
                        
                        user.save(function(err){
                            if (err) {
                                req.flash("error", "Something went wrong")
                                res.redirect("/campgrounds")
                            }
                            req.logIn(user, function(err){
                                done(err, user);
                            })
                        })
                    })
                } else {
                    req.flash("error", "Passwords do not match");
                    return res.redirect('back');
                }
            })
        },
        function(user, done) {
            var smtpTransport = nodemailer.createTransport({
                service: 'Gmail',
                auth: {
                    user: 'caelinsutch@gmail.com',
                    pass: process.env.GMAIL
                }
            });
            var mailOptions = {
                to: user.email,
                from: 'caelinsutch@gmail.com',
                subject: "Your password has been changed",
                text: "Hello, " + '/n/n' +
                    "This is a confirmation that the password for your account " + user.email + " has been changed"
            };
            smtpTransport.sendMail(mailOptions, function(err) {
                req.flash('success', "Success! Your password has been changed!");
                done(err);
            })
        }
    ], function(err) {
            if (err) {
                req.flash("error", "Something went wrong")
                res.redirect("/campgrounds")
            }
        res.redirect('/campgrounds');
    })
})

//Profile Route
router.get("/users/:username", function(req, res){
    User.find({username: req.params.username}, function(err, foundUser){
        if(err) {
            req.flash("error", "Something Went Wrong");
            return res.redirect("/")
        }
        foundUser = foundUser[0]
        Campground.find().where('author.id').equals(foundUser.id).exec(function(err, campgrounds){
            if(err){
                req.flash("error", "Something went wrong.")
                res.redirect("/")
            }
            res.render("users/show", {user: foundUser, campgrounds: campgrounds})
        })
    })
})
module.exports = router;