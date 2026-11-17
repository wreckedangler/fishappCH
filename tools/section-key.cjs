const {createHash}=require("node:crypto");

module.exports=function sectionKey(parts) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0,20);
};
