import { getValueByPath, setValueByPath } from "./pathUtils.js";

// 读取目标集合；如果路径不存在或类型不对，返回空数组（只读兜底）。
export function getCollectionByPath(sourceDataWrapper, targetCollection) {
  const value = getValueByPath(sourceDataWrapper, targetCollection);
  return Array.isArray(value) ? value : [];
}

// 确保目标集合存在且为数组，不存在则创建空数组并返回。
export function ensureCollectionByPath(sourceDataWrapper, targetCollection) {
  const value = getValueByPath(sourceDataWrapper, targetCollection);
  if (Array.isArray(value)) {
    return value;
  }
  setValueByPath(sourceDataWrapper, targetCollection, []);
  return getValueByPath(sourceDataWrapper, targetCollection);
}

// 向目标集合追加一项并返回最新集合引用。
export function addItemToCollection(sourceDataWrapper, targetCollection, item) {
  const nextCollection = ensureCollectionByPath(sourceDataWrapper, targetCollection);
  nextCollection.push(item);
  return nextCollection;
}

// 从目标集合移除一项：支持函数匹配、索引匹配、键值匹配三种方式。
export function removeItemFromCollection(sourceDataWrapper, targetCollection, matcher) {
  const collection = getValueByPath(sourceDataWrapper, targetCollection);
  if (!Array.isArray(collection) || !collection.length) {
    return false;
  }

  let indexToRemove = -1;

  // 按不同 matcher 形态计算要删除的下标。
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

  // 下标越界或未命中时，保持原集合不变。
  if (indexToRemove < 0 || indexToRemove >= collection.length) {
    return false;
  }

  collection.splice(indexToRemove, 1);
  return true;
}
