
const fs = require("fs");

exports.getNamespace = (config => config.require("k8s-namespace"));
exports.getPortalHost = (config => config.require("portal-host"));

exports.readFile = (path => fs.readFileSync(path, "utf-8"));


function Mergeable(o) {
    Object.assign(this, o);
}

Mergeable.prototype = Object.prototype;
Mergeable.prototype.merge = function(that) {

  const isObject = (obj) => obj && typeof obj === 'object';

  if (!isObject(this) || !isObject(that)) {
    return that;
  }

  Object.keys(that).forEach(key => {
    const thisValue = this[key];
    const thatValue = that[key];

    if (Array.isArray(thisValue) && Array.isArray(thatValue)) {
      this[key] = thisValue.concat(thatValue);
    } else if (isObject(thisValue) && isObject(thatValue)) {
        this[key].merge(thatValue)
    } else {
      this[key] = thatValue;
    }
  });

  return this;
}

exports.Mergeable = Mergeable;
