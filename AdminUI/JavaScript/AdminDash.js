const Service_List = document.querySelector('.scroll-list-box ul');

for (let index = 1; index <= 30; index++) 
{
    // Variables
    const Index_li = document.createElement('li');
    const Name = `Placeholder ${index}`;

    // Shorthands
    const Button_Parts = [`<button type="button" onclick="selectItem('${Name}')">`, `</button>`];

    // Assembly
    Index_li.innerHTML = `${Button_Parts[0]}${Name}<p>NaN</p>${Button_Parts[1]}`;
    Service_List.appendChild(Index_li);
}