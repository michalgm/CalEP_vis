var svg, info, tooltip, chord, height, width, labelSize;
var districts = [];
var matrix = [];
var districtIndex = {};
var rows = [];
var displayType = 'districts';
var maxLabel = "";
var debugMode = false;

var addDistrict = function(d) {
  if (d) {
    d = $.trim(d);

    if (displayType == 'districts' && (d == 'Expert' || d == 'Neutral - CEP' || d == 'Neutral - WestEd')) { 
      return;
    }
    if (d.length > maxLabel.length) { maxLabel = d; } //Find longest label

    if (! districtIndex[d]) {
      districtIndex[d] = 1;
    }
  }
}

var getGets = function(row) {
  var gets = [];
  if (row.get) {
    gets.push(row.get);
  }
  var x = 2;
  while (row['get_'+x]) {
    gets.push(row['get_'+x]);
    x++;
  }
  return gets;
}

var createMap = function() {
  $.each(rows, function(i, row) {
    addDistrict(row.give);
    $.map(getGets(row), addDistrict);
  });

  //set labelSize to 1/2 of longest label length
  labelTest = svg.append('text').attr('id', 'maxLabel').text(maxLabel);
  labelSize = $('#maxLabel')[0].getBBox().width;
  labelTest.remove();

  var x = 0;
  $.each(districtIndex, function(d) {
    districtIndex[d] = x;
    matrix[x] = [];
    for (var c = 0; c < Object.keys(districtIndex).length; c++) { 
      matrix[x].push(0);
    }
    districts[x] = {
      index: x,
      name:d,
      relationships: {},
      gives:0,
      gets: 0
    }
    x++;
  })

  var updateMatrix = function(from, to, rowIndex, count, mutual) {
    if (from == to) { return; } //Don't count self-relations

    var minval = 0;
    var val = 1;
    if (count) {
      val = 1/count;
    }

    matrix[from][to]+= val + minval;
    if (displayType == 'both') {
       matrix[to][from] += val + minval;
    } else {
      matrix[to][from] += minval;      
    }
    var addRelation = function(a, b, type) {
      var value = {id: rowIndex, type: type};
      if (districts[a].relationships[b] === undefined) {
        districts[a].relationships[b] = [value]
      } else {
        districts[a].relationships[b].push(value);
      }
    }
    if (!mutual) {
      addRelation(from, to, 'give');
      addRelation(to, from, 'get');
    } else {
      addRelation(from, to, 'mutual');
    }
    districts[from].gives += val;
    districts[to].gets += val;
  }

  $.each(rows, function(rowIndex, row) {
    var gets = getGets(row);

    if (row.give && districtIndex[row.give] !== undefined) {
      var from = districtIndex[row.give];
      var to = districtIndex[row.get];

      if (displayType == 'get') {
        to = districtIndex[row.give];
      }
      $.each(gets, function(i, value){
        if (displayType == 'get') {
          from = districtIndex[value];
        } else {
          to = districtIndex[value];
        }
        updateMatrix(from, to, rowIndex, gets.length);        
      })
    } else { //Process as a mutual give/get
      $.each(gets, function(i, get1){
        $.each(gets, function(i, get2){
          from = districtIndex[get1];
          to = districtIndex[get2];
          if (displayType == 'get') {
            from = districtIndex[get2];
            to = districtIndex[get1];
          }
          updateMatrix(from, to, rowIndex, gets.length-1, true);  
        })
      })
    }
  });
  //console.log(JSON.stringify(matrix).replace(/],/g, "],\n"));
  drawGraph();
}

//Find angles for district labels (1/2)
var startAngle = function(i) {
  return chord.groups()[i].startAngle;
}

//Find angles for district labels (2/2)
var endAngle = function(i) {
  return chord.groups()[i].endAngle;
}

var resize = function() {
  var width = $('#viz-container').width();
  var height = $('#content').height();
  graphSize = Math.min(width, height);
  $('#viz-container svg').attr("width", graphSize)
    .attr("height", graphSize)
  svg.attr("transform", "translate(" + graphSize / 2 + "," + graphSize / 2 + ")")

  var innerRadius = graphSize * 0.41 - labelSize;
  var outerRadius = innerRadius * 1.1;

  svg.selectAll(".chord-group")
    .data(chord.groups)
    .attr("d", d3.svg.arc().innerRadius(innerRadius).outerRadius(outerRadius))
  
  svg.selectAll(".chord")
    .data(chord.chords)
    .attr("d", d3.svg.chord().radius(innerRadius))

  svg.selectAll(".labels text")
    .data(chord.groups)
    .attr("transform", function(d) {
      return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")"
        + "translate(" + (outerRadius + 10) + ")"
        + (d.angle > Math.PI ? "rotate(180)" : "");
    })
}

var initGraph = function() {
  $('.loading').hide();
  $('#controls').show();
  var width = $('#viz-container').width();
  var height = $('#content').height();
  graphSize = Math.min(width, height); //use the smaller dimension
  svg = d3.select("#viz-container").append("svg")
    .attr('id', 'chordGraph')
    .attr("width", graphSize)
    .attr("height", graphSize)
    .append("g")
    .attr("transform", "translate(" + graphSize / 2 + "," + graphSize / 2 + ")")
    .on('mousemove', function() {
      if (tooltip.style('display') != 'none') {
        moveTooltip();
      }
    })
    .on('mouseout', hideTooltip)
    
  info = d3.select('#info')//.append('div').attr('id', 'info');

  $('#controls input').on('change', redrawGraph);
  $(window).on('resize', resize);
  tooltip = d3.select('#content').append('div').attr('id', 'tooltip');
}

var redrawGraph = function() {
  displayType = $("input:radio[name=display-type]:checked").val();
  matrix = [];
  maxLabel = "";
  districtIndex = {};
  districts = [];
  svg.selectAll("*").remove()
  createMap();
  $('#info').hide();
}

var moveTooltip = function() {
  tooltip.style('top', d3.event.pageY +5 +'px');
  tooltip.style('left', d3.event.pageX + 5 + 'px');
}

var showTooltip = function(text) {
  moveTooltip();
  tooltip.style('display', 'block');
  tooltip.html(text);
}

var hideTooltip = function() {
  tooltip.style('display', 'none');
}

var showInfo = function(first, second) { 
  $('#info .panel-title').html('');
  $('#info .list-group').html('');
  $('#info').show();
  $('#info .nav-tabs>li').show();
  $('#info .nav-tabs li:first a').html(first);
  $('#info .nav-tabs li:nth-child(2) a').html(second)
}

var showRow = function(rowIndex, type, districtid) {
  var row = rows[rowIndex];
  // var tab = districtid !== undefined ? '#'+type+'s' : '>';

  var subtitle = row.when + ' - ' + row.specificwhat;
  if (row.give == 'Expert') {
    subtitle += ' (Expert)';
  }
  if (districtIndex[row.give] === undefined) {
    subtitle += ' (Mutual)';
  } 
  var details = "";
  details += row._orig_give ? "<div>Host: "+row._orig_give+"</div>" : "";
  // details += (type == 'get' || districtid === undefined) && row._orig_give ? "<div>Host: "+row._orig_give+"</div>" : "";
  details += "Participants: " + getGets(row).join(', ');
  var surveyLink = (row.survey && row.survey.match(/^http/i)) ? " <a class='btn btn-default btn-sm' target='_blank' href='" + row.survey + "'> Survey</a>" : "";
  var onlineSpaceLink = (row.onlinespace && row.onlinespace.match(/^http/i)) ? " <a class='btn btn-default btn-sm' target='_blank' href='" + row.onlinespace + "'> Online Space</a>" : "";
  var buttons = surveyLink + onlineSpaceLink;
  $('#info #'+type+'s .list-group').append(
    "<li class='row-info list-group-item'>"
      + "<span class='pull-right btn-group'>"+buttons+"</span>"
      + "<h4 class='list-group-item-heading'>"+subtitle+"</h4>"
      + "<div class='list-group-item-text'>"+details+"</div>"
      + "</li>"
  );
}

var drawGraph = function() {
  var innerRadius = graphSize * 0.41 - labelSize;
  var outerRadius = innerRadius * 1.1;

  var fade = function(opacity) {
    return function(g, i) {
      svg.selectAll(".chords path")
        .filter(function(d) { 
          if (g.source) {
            return d.source.index !== g.source.index || d.target.index !== g.target.index;
          } else {
            return d.source.index !== i && d.target.index !== i; 
          }
        })
        .transition()
        .style("opacity", opacity);
    };
  }

  chord = d3.layout.chord()
    .padding(0.02)
    .sortChords( d3.descending ) 
    .sortGroups(d3.descending)
    .sortSubgroups(d3.descending)
    .matrix(matrix);

  var fill = d3.scale.category20()

  //Defining arcs / chord-groups
  svg.append("g").attr('class', 'chord-groups').selectAll("path")
    .data(chord.groups)
    .enter().append("path")
    .attr('class', 'chord-group')
    .style("fill", function(d) { return fill(d.index); })
    .style("stroke", function(d) { return fill(d.index); })
    .attr("d", d3.svg.arc().innerRadius(innerRadius).outerRadius(outerRadius))
    //Click to add arc / district data to side of page
    .on("click", function(d, i) {
      showInfo('Gives', 'Gets');
      var district = districts[d.index];
      var title = district.name
      $('#info .panel-title').html(title);

      var rowIndexes = {};
      $.each(district.relationships, function(relatedDistrictIndex, relationship) {
        $.each(relationship, function(index, r){
          rowIndexes[r.id] = r.type;
        })
      })

      $.each(rowIndexes, function(rowIndex, type){
        showRow(rowIndex, type, d.index)
      })
      $('.tab-content .list-group:empty').html('<li class="list-group-item"><div class="list-group-item-text">No experiences</div></li>')
      $('#info .nav-tabs li:first a').tab('show');
    })
    // .on("mouseover", function(d, i) {
    //   var tooltip = districts[i].name 
    //     + "<br/>Gives: "+roundToTwo(districts[i].gives)
    //     + "<br/>Gets: "+roundToTwo(districts[i].gets);

    //   showTooltip(tooltip);
    //   fade(0.1)(d, i);
    // })
    .on("mouseout", fade(1))
  
  //Chords are defined
  svg.append("g")
    .attr("class", "chords")
    .selectAll("path")
    .data(chord.chords)
    .enter().append("path")
    .attr("class", "chord")
    .attr("d", d3.svg.chord().radius(innerRadius))
    .style("fill", function(d) { return fill(d.source.index); })
    .style("opacity", 1)
    .on("click", function(d, i) {
      showInfo(districts[d.source.index].name, districts[d.target.index].name);
      var relationship = districts[d.source.index].relationships[d.target.index];
      var title = districts[d.source.index].name + ' to / from '+ districts[d.target.index].name;
      $('#info .panel-title').html(title);

      $.each(relationship, function(index, r){
        showRow(r.id, r.type);
      })
      $('.tab-content .list-group:empty').html('<li class="list-group-item"><div class="list-group-item-text">No experiences</div></li>')
      $('#info .nav-tabs li:first a').tab('show');
    })
    //Tooltip on chords shows 'From District X to District Y'
    .on("mouseover", function(d, i) {
      var sourceDistIndex =  d.source.index;
      var targetDistIndex = d.target.index;
      
      //These are reversed if the display is 'get-oriented'
      if (displayType == 'get') {
        sourceDistIndex =  d.target.index;
        targetDistIndex = d.source.index;
      }

      var tooltip = districts[sourceDistIndex].name + " to / from " + districts[targetDistIndex].name;

//Old tooltip showing # of gives / gets - keep for debug mode?
      // var tooltip = districts[sourceDistIndex].name + " to " + districts[targetDistIndex].name
      //   + ": " + roundToTwo(matrix[sourceDistIndex][targetDistIndex])
      //   + "</br>" + districts[targetDistIndex].name + " to " + districts[sourceDistIndex].name
      //   + ": " + roundToTwo(matrix[targetDistIndex][sourceDistIndex]);
      showTooltip(tooltip);
      fade(0.1)(d, i);
    })
    .on("mouseout", fade(1))

  //Adding district names to arcs
  svg.append("g")
    .attr("class", "labels")
    .selectAll("text")
    .data(chord.groups)
    .enter().append("text")
    .each(function(d, i) { d.angle = (startAngle(i) + endAngle(i)) / 2; })
    .attr("dy", ".35em")
    .attr("text-anchor", function(d) { return d.angle > Math.PI ? "end" : null; })
    .attr("transform", function(d) {
      return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")"
          + "translate(" + (outerRadius + 10) + ")"
          + (d.angle > Math.PI ? "rotate(180)" : "");
    })
    .text(function(d, i) { return districts[i].name; });
}

var roundToTwo = function(num) {    
    return +(Math.round(num + "e+2")  + "e-2");
}

$(function() {
  var tabletop;
  var fetchData = function() {
    tabletop = Tabletop.init( { 
      key: '1XkV1ePpq5piIfonZWShm7SZd78lqKvvgSP_u2hl54ic', 
      callback: function(data) { 
        if (rows[0]) { return; }
        initGraph();
        $.each(data, function(i, row) {
            row._orig_give = row.give;
          if ($.trim(row.strand) == 'Expert') {
            row.give = 'Expert';
          }
        });
        rows = data;
        createMap();
      },
      simpleSheet: true,
      debug:true
    } );
  }

  var checkData = function() {
    if (rows[0]) { return; }
    fetchData();
    setTimeout(checkData, 3500);
  }
  
  checkData();
})
