const mongoose=require("mongoose");
const initData=require("./data.js");
const Listing=require("../models/listing.js");



const MONGO_URL="mongodb://127.0.0.1:27017/wanderlust";


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
    await mongoose.connect(MONGO_URL)
};
const initDB=async ()=>
{
    await Listing.deleteMany({});
    // Check if initDB.data is undefined, initialize to empty array if so
initData.data = initData.data.map((obj) => ({ ...obj, owner: "668106222561107e7b60ec8f" }));

    await Listing.insertMany(initData.data);
    console.log("data was initialised");
};
initDB();