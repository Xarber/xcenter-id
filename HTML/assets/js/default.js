//Fix star ratings
document.querySelectorAll('div.rating:has(span.star)').forEach(e=>{
    e.querySelector('span.star').classList.add('checked');
    function makeid(length) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        let counter = 0;
        while (counter < length) {
          result += characters.charAt(Math.floor(Math.random() * charactersLength));
          counter += 1;
        }
        return result;
    }
    var ratingID = makeid(20);
    while (document.querySelector('div.rating#'+ratingID+':has(span.star)')) {ratingID = makeid(20);e.id = ratingID;}
    e.id = ratingID;
    var hiddenInput = document.createElement('input');
    hiddenInput.style.display = "none";
    hiddenInput.name = "rating-" + e.id + "/" + (e.getAttribute('name') ?? "");
    hiddenInput.value = "1";
    hiddenInput.id = "rating-"+e.id+"-value";
    e.appendChild(hiddenInput);
    var stars = e.querySelectorAll('span.star');
    var script = `this.parentNode.querySelectorAll('span.star').forEach(e=>e.classList.remove('checked'));this.classList.add('checked');`;
    for (var i = 0;i < stars.length;i++) {
        var star = stars[i];
        star.id = "rating-"+ratingID+"-star-"+i;
        for (var j = 0;j < i;j++) {
            script+=`this.parentNode.querySelector('span.star#rating-${ratingID}-star-${j}').classList.add('checked');`;
        }
        script+=`this.parentNode.querySelector('input#rating-${e.id}-value').value = '${i + 1}';`;
        star.setAttribute('onclick', script);
    }
})