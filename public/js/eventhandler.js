function onMouseOver(element){
	var id = $(element).attr('id');
	var label = "label_" + id.split("_")[1]
  document.getElementById(label).style.visibility = "visible";
}

function onMouseLeave(element){
	var id = $(element).attr('id');
	var label = "label_" + id.split("_")[1]
  //document.getElementById(label).style.visibility = "hidden";
}