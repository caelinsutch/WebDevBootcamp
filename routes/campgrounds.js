var express = require('express'),
    router = express.Router(),
    Campground = require("../models/campground"),
    middleWare = require("../middleware"),
    cloudinary = require("cloudinary"),
    multer = require('multer'),
    storage = multer.diskStorage({
        filename: function(req, file, callback) {
            callback(null, Date.now() + file.originalname);
        }
    }),
    imageFilter = function (req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    },
    upload = multer({storage: storage, fileFilter: imageFilter});

var dotenv = require('dotenv');
dotenv.config({path: './passwords.env'})
//Configure Cloudinary
cloudinary.config({
    cloud_name: 'dg0mlrlfd',
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

//INDEX - show all campgrounds
router.get("/", function(req, res){
    // Get all campgrounds from DB
    var noMatch = null;
    if (req.query.search) {
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        Campground.find({name: regex}, function(err, allCampgrounds){
           if(err){
               console.log(err);
           } else {
               if(allCampgrounds.length < 1){
                   noMatch = "No Campgrounds Found"
               }
              res.render("campgrounds/index",{campgrounds:allCampgrounds, noMatch: noMatch});
           }
        });
    } else {
        Campground.find({}, function(err, allCampgrounds){
           if(err){
               console.log(err);
           } else {
              res.render("campgrounds/index",{campgrounds:allCampgrounds, noMatch: noMatch});
           }
        });
    }
});

//CREATE - add new campground to DB
router.post("/", middleWare.isLoggedIn, upload.single('image'), function(req, res) {
    cloudinary.v2.uploader.upload(req.file.path, function(err, result) {
      if(err) {
        req.flash('error', err.message);
        return res.redirect('back');
      }
      // add cloudinary url for the image to the campground object under image property
      req.body.campground.image = result.secure_url;
      // add image's public_id to campground object
      req.body.campground.imageId = result.public_id;
      // add author to campground
      req.body.campground.author = {
        id: req.user._id,
        username: req.user.username
      }
      Campground.create(req.body.campground, function(err, campground) {
        if (err) {
          req.flash('error', err.message);
          return res.redirect('back');
        }
        res.redirect('/campgrounds/' + campground.id);
      });
    });
});

//NEW - show form to create new campground
router.get("/new", middleWare.isLoggedIn, function(req, res){
   res.render("campgrounds/new"); 
});

// SHOW - shows more info about one campground
router.get("/:id", function(req, res){
    //find the campground with provided ID
    Campground.findById(req.params.id).populate("comments").exec(function(err, foundCampground){
        if(err){
            console.log(err);
        } else {
            //render show template with that campground
            res.render("campgrounds/show", {campground: foundCampground});
        }
    });
});

//EDIT Campground Route
router.get("/:id/edit", middleWare.checkCampgroundOwnership, function(req, res){
    Campground.findById(req.params.id, function(err, foundCampground){
        if(err){
            res.redirect("/campgrounds")
            req.flash("error", "Campground not found.")
        } else {
            if(!foundCampground) {
                req.flash("error", "Campground not found.")
            }
            
            res.render("campgrounds/edit", {campground: foundCampground})
        }
    })
})


// UPDATE Campground Route
router.put("/:id", upload.single('image'), middleWare.checkCampgroundOwnership, function(req, res){
    Campground.findById(req.params.id, async function(err, campground){
        if(err){
            req.flash("error", err.message);
            res.redirect("back");
        } else {
            if (req.body.image) {
              try {
                  await cloudinary.v2.uploader.destroy(campground.imageId);
                  await cloudinary.v2.uploader.upload(req.file.path, function(result){
                      campground.imageId = result.public_id;
                      campground.image = result.secure_url; 
                  });
              } catch(err) {
                  req.flash("error", err.message);
                  return res.redirect("back");
              }
            }
            campground.name = req.body.campground.name;
            campground.description = req.body.campground.description;
            campground.save();
            req.flash("success","Successfully Updated!");
            res.redirect("/campgrounds/" + campground._id);
        }
    });
});

//DESTROY Campground Route
router.delete("/:id", middleWare.checkCampgroundOwnership, function(req, res){
    Campground.findById(req.params.id, async function(err, campground){
        if(err){
            res.redirect("/campgrounds")
            req.flash("error", "Campground not found")
        } else {
            try {
                await cloudinary.v2.uploader.destroy(campground.imageId);
                campground.remove()
                req.flash("success", "Campground Deleted Succesfully!");
                res.redirect("/campgrounds")
            } catch(err) {
                if(err) {
                    req.flash("error", err.message);
                    return res.redirect("back")
                    console.log(err)
                }
            }
        }
    })
})

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

module.exports = router;