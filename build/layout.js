/* Axes system. This allows us to at-will work in a different orientation
 without having to manually keep track of knowing if we should be using
 x or y positions. */

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var axes = {
  row: {},
  column: {}
};

axes.row.main = {
  start: 'x',
  end: 'x2',
  size: 'w'
};
axes.row.cross = {
  start: 'y',
  end: 'y2',
  size: 'h'
};
axes.column.main = axes.row.cross;
axes.column.cross = axes.row.main;

var types = [{ name: 'side', values: ['start', 'end'] }, { name: 'standing', values: ['above', 'right', 'below', 'left'] }, { name: 'flow', values: ['column', 'row'] }];

var validTypeValues = types.reduce(function (xs, _ref2) {
  var values = _ref2.values;
  return xs.concat(values);
}, []);

var fitWithinChecker = function fitWithinChecker(dimension) {
  return function (domainSize, itemSize) {
    return domainSize[dimension] > itemSize[dimension];
  };
};

var doesWidthFitWithin = fitWithinChecker('w');

var doesHeightFitWithin = fitWithinChecker('h');

var doesFitWithin = function doesFitWithin(domainSize, itemSize) {
  return doesWidthFitWithin(domainSize, itemSize) && doesHeightFitWithin(domainSize, itemSize);
};

var equalCoords = function equalCoords(c1, c2) {
  for (var key in c1) if (c1[key] !== c2[key]) return false;
  return true;
};

/* Algorithm for picking the best fitting zone for popover. The current technique will
loop through all zones picking the last one that fits. If none fit the last one is selected.
TODO: In the case that none fit we should pick the least-not-fitting zone. */

var pickZone = function pickZone(opts, frameBounds, targetBounds, size) {
  var t = targetBounds,
      f = frameBounds;

  var zones = [{ side: 'start', standing: 'above', flow: 'column', order: -1, w: f.x2, h: t.y }, { side: 'end', standing: 'right', flow: 'row', order: 1, w: f.x2 - t.x2, h: f.y2 }, { side: 'end', standing: 'below', flow: 'column', order: 1, w: f.x2, h: f.y2 - t.y2 }, { side: 'start', standing: 'left', flow: 'row', order: -1, w: t.x, h: f.y2 }];

  var availZones = zones.filter(function (zone) {
    return doesFitWithin(zone, size);
  });

  /* If a place is required pick it from the available zones if possible. */

  if (opts.place) {
    var _ret = (function () {
      var type = getPreferenceType(opts.place);
      if (!type) throw createPreferenceError(opts.place);
      var finder = function finder(z) {
        return z[type] === opts.place;
      };
      return {
        v: find(finder, availZones) || find(finder, zones)
      };
    })();

    if (typeof _ret === 'object') return _ret.v;
  }

  /* If the preferred side is part of the available zones, use that otherwise
  pick the largest available zone. If there are no available zones, pick the
  largest zone. TODO: logic that executes picking based on largest option. */

  if (opts.preferPlace) {
    var _ret2 = (function () {
      var preferenceType = getPreferenceType(opts.preferPlace);
      if (!preferenceType) throw createPreferenceError(opts.preferPlace);
      var preferredAvailZones = availZones.filter(function (zone) {
        return zone[preferenceType] === opts.preferPlace;
      });
      if (preferredAvailZones.length) return {
          v: preferredAvailZones[0]
        };
    })();

    if (typeof _ret2 === 'object') return _ret2.v;
  }

  return availZones.length ? availZones[0] : zones[0];
};

var find = function find(f, xs) {
  return xs.reduce(function (b, x) {
    return b ? b : f(x) ? x : null;
  }, null);
};

var createPreferenceError = function createPreferenceError(givenValue) {
  return new Error('The given layout placement of "' + givenValue + '" is not a valid choice. Valid choices are: ' + validTypeValues.join(' | ') + '.');
};

var getPreferenceType = function getPreferenceType(preference) {
  return types.reduce(function (found, type) {
    if (found) return found;
    return ~type.values.indexOf(preference) ? type.name : null;
  }, null);
};

var calcRelPos = function calcRelPos(zone, masterBounds, slaveSize) {
  var _ref;

  var _axes$zone$flow = axes[zone.flow];
  var main = _axes$zone$flow.main;
  var cross = _axes$zone$flow.cross;

  /* TODO: The slave is hard-coded to align cross-center with master. */
  var crossAlign = 'center';
  var mainStart = place(zone.flow, 'main', zone.side, masterBounds, slaveSize);
  var mainSize = slaveSize[main.size];
  var crossStart = place(zone.flow, 'cross', crossAlign, masterBounds, slaveSize);
  var crossSize = slaveSize[cross.size];

  return (_ref = {}, _defineProperty(_ref, main.start, mainStart), _defineProperty(_ref, 'mainLength', mainSize), _defineProperty(_ref, main.end, mainStart + mainSize), _defineProperty(_ref, cross.start, crossStart), _defineProperty(_ref, 'crossLength', crossSize), _defineProperty(_ref, cross.end, crossStart + crossSize), _ref);
};

var place = function place(flow, axis, align, bounds, size) {
  var axisProps = axes[flow][axis];
  return align === 'center' ? centerOfBounds(flow, axis, bounds) - centerOfSize(flow, axis, size) : align === 'end' ? bounds[axisProps.end] : align === 'start'
  /* DOM rendering unfolds leftward. Therefore if the slave is positioned before
  the master then the slave's position must in addition be pulled back
  by its [the slave's] own length. */
  ? bounds[axisProps.start] - size[axisProps.size] : null;
};

var centerOfBounds = function centerOfBounds(flow, axis, bounds) {
  var props = axes[flow][axis];
  return bounds[props.start] + bounds[props.size] / 2;
};

var centerOfBoundsFromBounds = function centerOfBoundsFromBounds(flow, axis, boundsTo, boundsFrom) {
  return centerOfBounds(flow, axis, boundsTo) - boundsFrom[axes[flow][axis].start];
};

var centerOfSize = function centerOfSize(flow, axis, size) {
  return size[axes[flow][axis].size] / 2;
};

/* Element-based layout functions */

var El = {};

El.calcBounds = function (el) {

  if (el === window) {
    return {
      x: 0,
      y: 0,
      x2: el.innerWidth,
      y2: el.innerHeight,
      w: el.innerWidth,
      h: el.innerHeight
    };
  }

  var b = el.getBoundingClientRect();

  return {
    x: b.left,
    y: b.top,
    x2: b.right,
    y2: b.bottom,
    w: b.right - b.left,
    h: b.bottom - b.top
  };
};

El.calcSize = function (el) {
  return el === window ? { w: el.innerWidth, h: el.innerHeight } : { w: el.offsetWidth, h: el.offsetHeight };
};

El.calcScrollSize = function (el) {
  return el === window ? {
    w: el.scrollX || el.pageXOffset,
    h: el.scrollY || el.pageYOffset
  } : { w: el.scrollLeft, h: el.scrollTop };
};

exports.types = types;
exports.validTypeValues = validTypeValues;
exports.calcRelPos = calcRelPos;
exports.place = place;
exports.pickZone = pickZone;
exports.axes = axes;
exports.centerOfSize = centerOfSize;
exports.centerOfBounds = centerOfBounds;
exports.centerOfBoundsFromBounds = centerOfBoundsFromBounds;
exports.doesFitWithin = doesFitWithin;
exports.equalCoords = equalCoords;
exports.El = El;