import { getValueByPath, setValueByPath } from "./pathUtils";

export function getCollectionByPath(sourceDataWrapper, targetCollection) {
  const value = getValueByPath(sourceDataWrapper, targetCollection);
  return Array.isArray(value) ? value : [];
}

export function addItemToCollection(sourceDataWrapper, targetCollection, item) {
  const collection = getValueByPath(sourceDataWrapper, targetCollection);

  if (!Array.isArray(collection)) {
    setValueByPath(sourceDataWrapper, targetCollection, []);
  }

  const nextCollection = getValueByPath(sourceDataWrapper, targetCollection);
  nextCollection.push(item);
  return nextCollection;
}

export function removeItemFromCollection(sourceDataWrapper, targetCollection, matcher) {
  const collection = getValueByPath(sourceDataWrapper, targetCollection);
  if (!Array.isArray(collection) || !collection.length) {
    return false;
  }

  let indexToRemove = -1;

  if (typeof matcher === "function") {
    indexToRemove = collection.findIndex((item, index) => matcher(item, index));
  } else if (matcher && typeof matcher === "object") {
    if (Number.isInteger(matcher.index)) {
      indexToRemove = matcher.index;
    } else if (matcher.rowKey) {
      indexToRemove = collection.findIndex((item) => item?.[matcher.rowKey] === matcher.value);
    } else if (matcher.key) {
      indexToRemove = collection.findIndex((item) => item?.[matcher.key] === matcher.value);
    }
  }

  if (indexToRemove < 0 || indexToRemove >= collection.length) {
    return false;
  }

  collection.splice(indexToRemove, 1);
  return true;
}
