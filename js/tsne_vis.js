// t-SNE.js object and other global variables
var color = d3.scale.category20();
var opt; var step_counter; var final_dataset; var max_counter; var dists; var all_labels; var svg; var timeout; var runner; var tsne;

// code that is executed when page is loaded
$(document).ready(function() {
    timeout = setTimeout(function() {
  	document.getElementById("timeout_error").style.display = "inline";
    }, 30000);
    init(getData());
});

// Parse data
function getData() {
    var rawData = [];

    var colNames = dataInit[0]
    for(var i = 1; i < dataInit.length;i++) {
	row = dataInit[i]
	var dataPoint = {};
	dataPoint['name'] = row[0];
	dataPoint['label'] = row[1];
	for(var j = 2; j < row.length; j++) {
	    if(row[j].length !== 0) {
		if(row[j] != "") {
		    //dataPoint.push({name:colNames[j].trim().toUpperCase(),value: parseFloat(row[j])});
		    //dataPoint.push(parseFloat(row[j]));
		    dataPoint[j]=parseFloat(row[j]);
		     
		}
	    }
	}
	if(dataPoint.length !== 0) {
	    rawData.push(dataPoint);
	}
    }

    return(rawData)
}

// function that executes after data is successfully loaded
function init(data) {
    step_counter = 0;
    max_counter = document.getElementById("param-maxiter-value").value;

    opt = {};
    opt.epsilon = document.getElementById("param-learningrate-value").value; // epsilon is learning rate (10 = default)
    opt.perplexity = document.getElementById("param-perplexity-value").value; // roughly how many neighbors each point influences (30 = default)
    opt.dim = 2; // dimensionality of the embedding (2 = default)

    tsne = new tsnejs.tSNE(opt);

    clearTimeout(timeout);
    final_dataset = data;
    for(var i = 0; i < final_dataset.length; i++) final_dataset[i].focus = 0;
    //dists = computeDistances(data, "euclideanDist", "noTrans");
    //dists = computeDistances(data, distFunc, transFunc);
    dists = computeDistances(data, document.getElementById("param-distance").value, document.getElementById("param-transform").value);
    tsne.initDataDist(dists); 
    all_labels = new Array(data.length);
    for(var i = 0; i < data.length; i++) { all_labels[i] = data[i]["label"]; }
    drawEmbedding();
    runner = setInterval(step, 0);
}

// initialize distance matrix
function initDist(data) {
    var dist = new Array(data.length);
    for(var i = 0; i < data.length; i++) {
      dist[i] = new Array(data.length);
    }
    for(var i = 0; i < data.length; i++) {
      for(var j = 0; j < data.length; j++) {
        dist[i][j] = 0;
      }
    }
    return dist;
}

// calculate euclidean distance
function euclideanDist(data) {
    dist = initDist(data);
    for(var i = 0; i < data.length; i++) {
      for(var j = i + 1; j < data.length; j++) {
        for(var d in data[0]) {
          if(d != "label" && d != "name" && d != focus) {
	      dist[i][j] += Math.pow(data[i][d] - data[j][d], 2);
          }
        }
        dist[i][j] = Math.sqrt(dist[i][j]);
        dist[j][i] = dist[i][j];
      }
    }
    return dist;
}

// calculate jaccard dist
function jaccardDist(data) {
    dist = initDist(data);
    for(var i = 0; i < data.length; i++) {
	for(var j = i + 1; j < data.length; j++) {
            for(var d in data[0]) {
		if(d != "label" && d != "name" && d != focus) {
		    x = data[i][d];
		    y = data[j][d];
		    if(x == y) {
			dist[i][j] += 1;
		    }
		}
            }
            dist[j][i] = dist[i][j];
	}
    }
    return dist;
}

// normalize distances to prevent numerical issues
function normDist(data, dist) {
    var max_dist = 0;
    for(var i = 0; i < data.length; i++) {
	for(var j = i + 1; j < data.length; j++) {
            if(dist[i][j] > max_dist) max_dist = dist[i][j];
	}
    }
    for(var i = 0; i < data.length; i++) {
	for(var j = 0; j < data.length; j++) {
            dist[i][j] /= max_dist;
	}
    }
    return dist;
}

function noTrans(data) {
    return data;
}
// Log transform
function logTrans(data) {
    for(var i = 0; i < data.length; i++) {
        for(var d in data[0]) {
	    if(d != "label" && d != "name" && d != focus) {
		X = data[i][d];
		data[i][d] = Math.log10(X + 1);
	    }
	}
    }
    return data;
}
// asinh transform
function asinhTrans(data) {
    for(var i = 0; i < data.length; i++) {
        for(var d in data[0]) {
	    if(d != "label" && d != "name" && d != focus) {
		X = data[i][d];
		data[i][d] = Math.log(X + Math.sqrt(X * X + 1));
	    }
	}
    }
    return data;
}
// binarize
function binTrans(data) {
    for(var i = 0; i < data.length; i++) {
        for(var d in data[0]) {
	    if(d != "label" && d != "name" && d != focus) {
		X = data[i][d];
		if(X > 0) data[i][d] = 1;
		if(X < 0) data[i][d] = 0;
	    }
	}
    }
    return data;
}

function computeDistances(data, distFunc, transFunc) {
    //window.alert(distFunc);
    //window.alert(transFunc);
    dist = eval(distFunc)(eval(transFunc)(data));
    dist = normDist(data, dist);
    return dist;
}

// function that updates embedding
function updateEmbedding() {
    var Y = tsne.getSolution();
    svg.selectAll('.u')
	.attr("transform", function(d, i) { return "translate(" +
                                            ((Y[i][0] * 7 * ss + tx) + 450) + "," +
                                            ((Y[i][1] * 7 * ss + ty) + 300) + ")"; });
}

var div, tooltip, legend;
// function that draws initial embedding
function drawEmbedding() {
    
    // Fill the embed div
    $("#embed").empty();
    div = d3.select("#embed");
    
    // Drawing area for map
    svg = div.append("svg")
	.attr("width", "100%")
	.attr("height", "100%");

    // Retrieve all data
    var g = svg.selectAll(".b")
	.data(final_dataset)
	.enter().append("g")
	.attr("class", "u")
    
    // Add circle for each data point
    g.append("svg:circle")
	.attr("stroke-width", 1)
	.attr("fill",   function(d) { return d ? color(d["label"]) : "#00F"; })
	.attr("stroke", function(d) { return d ? color(d["label"]) : "#00F"; })
	.attr("fill-opacity", .65)
	.attr("stroke-opacity", .9)
	.attr("opacity", 1)
	.attr("class", "node1")
	.attr("r", 6)
	.attr("data-legend", function(d) { return d ? d.label : ""; })
	.on("mouseover", function(d) {
            d.focus = 1;
            tooltip.style("visibility", function(dd) { return dd.focus == 1 ? "visible" : "hidden"; })
        })
	.on("mouseout", function(d) {
            d.focus = 0;
            tooltip.style("visibility", function(dd) { return dd.focus == 1 ? "visible" : "hidden"; })
        });
    
    // Add tooltips
    tooltip = g.append("svg:text")
	.attr("dx", 0)
	.attr("dy", 0)
	.style("position", "absolute")
	.style("visibility", "hidden")
	.attr("text-anchor", "right")
	.style("font-size", "12px")
	.text(function(d) {
            return d.name;
        });
    
    // Add zoom functionality to map
    var zoomListener = d3.behavior.zoom()
	.scaleExtent([0.1, 10])
	.center([0, 0])
	.on("zoom", zoomHandler);
    zoomListener(svg);
    
    // Draw legend
    legend = svg.append("g")
	.attr("class", "legend")
	.attr("transform", "translate(20, 27)")
	.call(d3.legend)    
}

// function that handles zooming
var tx = 0, ty = 0;
var ss = 1;
function zoomHandler() {
    tx = d3.event.translate[0];
    ty = d3.event.translate[1];
    ss = d3.event.scale;
    updateEmbedding();
}

// perform single t-SNE iteration
function step() {
    step_counter++;
    if(step_counter <= max_counter) {
	var cost = tsne.step();
	$("#cost").html("iteration " + tsne.iter + ", cost: " + cost);
    }
    else {
        clearInterval(runner);
        //document.getElementById("exportButton").disabled = false;
    }
    updateEmbedding();
}

