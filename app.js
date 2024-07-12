const express=require("express");


const app=express();
const mongoose=require("mongoose");
require('dotenv').config();
const dbUrl=process.env.ATLASDB_URL;
const Listing = require("./models/listing.js");
const path=require("path");
const methodOverride=require("method-override");
const ejsMate=require("ejs-mate");
const wrapAsync=require("./utils/wrapAsync.js");
const ExpressError=require("./utils/ExpressError.js")
const {listingSchema,reviewSchema}=require("./schema.js");
const Review = require("./models/review.js");
const session=require("express-session");
const MongoStore = require('connect-mongo');
const flash=require("connect-flash");
const passport=require("passport");
const LocalStrategy=require("passport-local");
const User=require("./models/user.js");
const {isReviewAuthor,isLoggedIn,isOwner}=require("./middleware.js");
const {saveRedirectUrl}=require("./middleware.js");

app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.use(express.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname,"/public")));
app.engine('ejs',ejsMate);
const store=MongoStore.create({
    mongoUrl:dbUrl,
    crypto:
    {
        secret:process.env.SECRET
    },
    touchAfter:24*60*60
});
store.on("error",()=>
{
   console.log("error in mongo session",err);
});
const sessionOptions=
{
    store,
    secret:process.env.SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:
    {
        expires:Date.now()+7*24*60*60*1000,
        maxAge:7*24*60*60*1000,
        httpOnly:true,
    },
};
// app.get("/",(req,res)=>
//     {
//         res.send("hi ,i am root");
//     });


app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));


passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next)=>
{
    res.locals.success=req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser=req.user;
    next();
});

// app.get("/demouser",async(req,res)=>
// {
//     let fakeUser=new User(
//         {
//             email:"student@gmail.com",
//             username:"delta-student"
//         }
//     );
//     let registerUser=await User.register(fakeUser,"helloworld");
//     res.send(registerUser);
// });

 main().then(()=>
    {
        console.log("connected to db");
    })
    .catch((err)=>
    {
        console.log(err);
    });
async function main()
{
    await mongoose.connect(dbUrl);
}



const validateListing = (req, res, next) => {
    const { error } = listingSchema.validate(req.body);
    if (error) {
        throw new ExpressError(400, error.message);
    } else {
        next();
    }
};
const validateReview = (req, res, next) => {
    const { error } = reviewSchema.validate(req.body);
    if (error) {
        throw new ExpressError(400, error.message);
    } else {
        next();
    }
};
app.get("/logout",(req,res,next)=>
{
    req.logOut((err)=>
    {
        if(err)
            {
                return next(err);
            }
            req.flash("success","you are logged out now");
            res.redirect("/listings");
    })
});
/*signUp */
app.get("/signup",(req,res)=>
{
    res.render("users/signup.ejs");
});
app.post("/signup",async(req,res)=>
{
    try{let {username,email,password}=req.body;
    const newUser=new User({email,username});
    let registerUser=await User.register(newUser,password);
     console.log(registerUser);
     req.logIn(registerUser,(err)=>
    {
        if(err)
            {
               return next(err);
            }
            req.flash("success","Welcome to WonderLust");
            res.redirect("/listings");
    });
     }
    catch(e)
    {
        req.flash("error",e.message);
        res.redirect("/signup");
    }
});
/*login*/
app.get("/login",(req,res)=>
{
  res.render("users/login.ejs");
});

app.post("/login",saveRedirectUrl,passport.authenticate("local",{failureRedirect:"/login",failureFlash:true}),async(req,res)=>
{
    req.flash("success","successfullully logined");
    let redirectUrl=res.locals.redirectUrl||"/listings";
    res.redirect(redirectUrl);
   
  
});
/*Add Review Route*/
app.post("/listings/:id/reviews",isLoggedIn,validateReview,wrapAsync(async(req,res) =>
    {
        let listing=await Listing.findById(req.params.id);
        let newReview=new Review(req.body.review);
        newReview.author=req.user._id;
        listing.reviews.push(newReview);
        await newReview.save();
        await listing.save();
        console.log("new review saved");
        res.redirect(`/listings/${listing._id}`);
    }));

/*Delete Review Route*/
app.delete("/listings/:id/reviews/:reviewId",isLoggedIn,isReviewAuthor,wrapAsync(async(req,res)=>
    {
        let {id,reviewId}=req.params;
        console.log(id);
        console.log(reviewId);
        await Listing.findByIdAndUpdate(id,{$pull : {reviews:reviewId}});
        await Review.findByIdAndDelete(reviewId);
        res.redirect(`/listings/${id}`);
    }));
// app.get("/testListing",async(req,res)=>
// {
//        let sampleListing = new Listing (
//         {
//             title:"My New villa",
//             description:"by the beach",
//             price:1200,
//             location:"calangute,Goa",
//             country:"India",
//         }
//        );
//      await sampleListing.save();
//      console.log("sample was saved");
//      res.send("successfull testing");
// });
app.listen(8080,()=>
{
    console.log("server is listening to port 8080");
});


//index Route

app.get("/listings",wrapAsync(async (req,res)=>
{
   const allListings=await Listing.find({});
   res.render("./listings/index.ejs",{allListings});
    
}));

//new route
app.get("/listings/new",isLoggedIn,(req,res)=>
    {
       
       res.render("./listings/new.ejs");
    });


//show route
app.get("/listings/:id",wrapAsync(async(req,res)=>
{
    let {id}=req.params;
    const listing=await Listing.findById(id).populate({path:"reviews",populate:
        {
            path:"author"
        },
    }).populate("owner");
    /*console.log(listing.image);*/
    await res.render("./listings/show.ejs",{listing});
}));

//create route
app.post("/listings",isLoggedIn,validateListing,wrapAsync(async(req,res,next)=>
{
   
    const newListing=new Listing(req.body.listing);
   newListing.owner=req.user._id;
   await newListing.save();
   req.flash("success","new listing created!");
   res.redirect("/listings");
}));

//edit route
app.get("/listings/:id/edit",isLoggedIn,isOwner,wrapAsync(async (req,res)=>
{
    let {id}=req.params;
    const listing=await Listing.findById(id);
    res.render("listings/edit.ejs",{listing});
}));

//update route
app.put("/listings/:id" ,isLoggedIn,isOwner, validateListing,wrapAsync(async(req,res)=>
{
    let {id}=req.params;
    await Listing.findByIdAndUpdate(id,{...req.body.listing});  
    res.redirect(`/listings/${id}`); 
}));

//delete ROute
app.delete("/listings/:id",isLoggedIn,isOwner,wrapAsync(async (req,res)=>
{
   let {id}=req.params;
   let deletedListing=await Listing.findByIdAndDelete(id);
   console.log(deletedListing);
   res.redirect("/listings");
}));
app.all("*",(req,res,next)=>
{
    next(new ExpressError(404,"page not found!"));
});
app.use((err,req,res,next)=>
{
    let {statusCode=500,message="something went wrong"}=err;
    res.status(statusCode).render("error.ejs",{err});
    //res.status(statusCode).send(message);
});

//reviews
//post route


