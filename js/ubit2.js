// Globals
var dataRaw;
var dataPro;
var successPerGenes;
var genesDetectedPerSample;

function initData() {
    dataRaw = getData();
    processData();
}

/*
function clearBox() {
    document.getElementById('incsv').value = "";       
}

// Read in raw data from form
function getData() {

    var txt = $("#incsv").val();
    //var txt = document.getElementById('incsv').value;
    var lines = txt.split("\n");
    var rawData = [];
    var dlen = -1;

    var delimName = document.getElementById("delimiter").value;
    var delim;
    if(delimName == "comma") {
	delim = ','
    }
    if(delimName == "tab") {
	delim = '\t'
    }

    var colNames = lines[0].split(delim);
    for(var i = 1; i < lines.length;i++) {
	row = lines[i].split(delim);
	var dataPoint = [];
	dataPoint['name'] = row[0];
	    for(var j = 1; j < row.length; j++) {
		if(row[j].length !== 0) {
		    dataPoint.push({name:colNames[j].trim(),value: parseFloat(row[j])});
		}
	    }
	rawData.push(dataPoint);
    }
    if(document.getElementById("transpose").checked) {
	rowNames = rawData.map(function(d) { return d.name })
	rawData = transposeTransform(rawData)
	rawData.map(function(d, i) { d.name = colNames[i+1] })
	rawData.map(function(d) { d.map(function(o, i) { o.name = rowNames[i] }) })
    } 

    // set global
    dataRaw = rawData;
}
*/

function getData() {
    var rawData = [];
    
    var colNames = dataInit[0]
    for(var i = 1; i < dataInit.length;i++) {
	row = dataInit[i]
	var dataPoint = [];
	dataPoint['name'] = row[0];
	for(var j = 1; j < row.length; j++) {
	    if(row[j].length !== 0) {
		if(row[j] != "") {
		    dataPoint.push({name:colNames[j].trim().toUpperCase(),value: parseFloat(row[j])});
		}
	    }
	}
	if(dataPoint.length !== 0) {
	    rawData.push(dataPoint);
	}
    }
    if(document.getElementById("transpose").checked) {
	rowNames = rawData.map(function(d) { return d.name })
	rawData = transposeTransform(rawData)
	rawData.map(function(d, i) { d.name = colNames[i+1] })
	rawData.map(function(d) { d.map(function(o, i) { o.name = rowNames[i] }) })
    } 

    return(rawData)
}

// Data processing and calculations
function processData() {
    // Local copy
    var data = $.extend(true, [], dataRaw);
    var fail = document.getElementById("biomark_fail").value;
    var lod = Number(document.getElementById("biomark_lod").value);
	
    // Calculate overall QC statistics
    var success = data.map(function(d) {
	var m = d.map(function(o) {
	    var t
	    if(o.value == fail) { t = 0 } // failure
	    else { t = 1 }
	    return {name: o.name, value: t}
	});
	m['name'] = d.name;
	return m	
    });    
    genesDetectedPerSample = success.map( function(d){
	var row = d.map(function(o) { return o.value })
	var count = row.reduce(function(a,b){ return a + b; }, 0);
	return {name: d.name, value: count / row.length}
    });    
    successPerGenes = success[0].map( function(o, i){
	var col = getCol(success, i).map(function(o) { return o.value })
	var count = col.reduce(function(a,b){ return a + b; }, 0);
	return {name: o.name, value: count / col.length}
    }); 

    // Transform
    var transform = document.getElementById("transform").value;

    if(transform == "log10") {
	data.map(function(d) { return d.map(function(o) {
	    o.value = Math.log10(o.value + 1);
	}) });
    }
    if(transform == "asinh") {
	data.map(function(d) { return d.map(function(o) {
	    o.value = Math.asinh(o.value);
	}) });
    }
    if(transform == "biomark") {
	data.map(function(d) { return d.map(function(o) {
	    var t = lod - o.value;
	    if(t < 0) { t = 0 }
	    o.value = t;
	}) });
    }

    // get rid of poor genes and samples
    var t1 = document.getElementById('percentage_success_per_gene_threshold_slider').value/100;
    var t2 = document.getElementById('percentage_genes_detected_per_sample_slider').value/100; 
    var data_filtered = [];
    for(var i = 0; i < data.length; i++){
	var row_i = data[i];
	var row_filtered = [];
	row_filtered['name'] = row_i.name;
	for(var j = 0; j < row_i.length; j++){
	    if(successPerGenes[j].value >= t1) {
		row_filtered.push(row_i[j])
	    }
	}
	if(genesDetectedPerSample[i].value >=t2) {
	    data_filtered.push(row_filtered)
	}
    }
    data = data_filtered;
    
    // need more rows than columns for pca
    if(data[0].length > data.length) {
	data = data.map(function(d) {
	    var s = d.slice(0, data.length)
	    s['name'] = d.name
	    return s
	})
    }
    
    // set global
    dataPro = data;

    // Get numeric values
    var data = dataPro.map(function(d) { return d.map(function(o) { return o.value }); });
    
    // K means groups
    var k = Number(document.getElementById('kmeans').value);
    var g = clusterfck.kmeans(data, k);
    // Map to data
    var gi = new Array();
    for ( var i = 0; i < k; i++ ) {	
	gi[i] = g[i][0].map(function(col, j) {
	    return g[i].map(function(row) {
		return row[j];
	    });
	});
    };
    var g1 = gi[Number(document.getElementById("diffexp_group1").value)-1];
    var g2 = gi[Number(document.getElementById("diffexp_group2").value)-1];

    // Row level metrics; store in object
    var fc = diffExpFc(g1, g2);
    var pval = diffExpPval(g1, g2);
    dataPro.map(function(d) { return d.map(function(o, i) {
	o.fc = fc[i];
	o.pval = pval[i];
    })});
    
    // Column level metrics, store in array
    var pca = new PCA();
    matrix = pca.scale(data, true, true);
    pc = pca.pca(matrix,2);

    var groups = getGroups(data, g);
    dataPro.map(function(d, i) {
	d.group = groups[i]
    });

    dataPro.map(function(d,i){
	d.pc1 = pc[i][0];
	d.pc2 = pc[i][1];
    });

}











// Transpose 2D array
function transposeTransform(array) {
    var newArray = array[0].map(function(col, i) {
	return array.map(function(row) {
	    return row[i]
	})
    });
    return newArray;
};

// Log10 all values of numeric 2D
function log10Transform(array) {
    var newArray = array
    for(var i = 0; i < array.length; i++) {
	row = array[i]
	for(var j = 0; j < row.length; j++) {
	    newArray[i][j] = Math.log10(array[i][j]+1);
	}
    }
    return newArray;
};


function getGroups(data, groups) {    
    function isGroupi(value) {
	var b = groups[i].indexOf(value) > -1;
	return +b; // convert from boolean to numeric
    }
    var groups_annot = new Array()
    for ( var i = 0; i < groups.length; i++) {	
	groups_annot[i] = data.map(isGroupi).map(function(x){ return x * (i+1) })
    }

    var groups_final = groups_annot[0].map(function(row, i) {
	return groups_annot.map(function(row) {
	    return row[i]; }
			       ).reduce(function(a, b) {
				   return a+b;
			       }, 0);
    });
    
    return groups_final;
}

// Differential expression P-vals by Mann Whistney U-test
function diffExpPval(g1, g2) {
    // calculate p-value
    var pval = [];
    for (i = 0; i < g1.length; i++) {
	var t = mannwhitneyu.test(g1[i], g2[i], alternative="two-sided");
	var p = -Math.log10(t['p']+0.00001); // pseudo
	if(isNaN(p)) { p = 1 }
	if(p == Number.POSITIVE_INFINITY) { p = 1 }
	pval.push(p);
    }

    return pval;
}

// Calculate mean
function mean(numbers) {
    var sum = 0,
	i;
    for (i = 0; i < numbers.length; i += 1) {
	sum += numbers[i];
    }
    return sum / numbers.length;
}

// Calculate variance
function variance(values){
    var avg = mean(values);

    var squareDiffs = values.map(function(value){
	var diff = value - avg;
	var sqrDiff = diff * diff;
	return sqrDiff;
    });

    var variance = mean(squareDiffs);

    return variance;
}

// Calculate fold change
function diffExpFc(g1, g2) {
    // calculate fold change
    var fc = [];
    for (i = 0; i < g1.length; i++) {
	var m1 = mean(g1[i])
	var m2 = mean(g2[i])
	    var t = (m2 + 0.0000001) / (m1+0.0000001) // pseudo
	t = Math.log2(t);
	if(isNaN(t)) { t = 0 }
	fc.push(t);
    }

    return fc;
}

function colVar(array) {
    array = transposeTransform(array);
    var colVar = array.map(function(d) { return variance(d)}) 
    return colVar
}



function getCol(matrix, col){
    var column = [];
    for(var i=0; i<matrix.length; i++){
	column.push(matrix[i][col]);
    }
    return column;
}
