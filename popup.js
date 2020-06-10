let copy_btn = document.getElementById("copy")
let paste_btn = document.getElementById("paste")
let format_select = document.getElementById("format")
let custom_format_input = document.getElementById("custom_format");
let all_windows_checkbox = document.getElementById("all_windows");
let status_span = document.getElementById("status");

format_select.addEventListener('change', (e) => {
	custom_format_input.classList[ e.target.value === 'custom' ? 'remove' : 'add']('hide')
})
const show_msg = (msg) => {
	status_span.innerText = msg;
	status_span.classList.add('fade');
}
copy_btn.addEventListener('click', (e) => {
	chrome.windows.getCurrent( (win) => {
		const query = (all_windows_checkbox.checked ? {} : {windowId: win.id})
		chrome.tabs.query(query, (tabs) => {
			//if more than one tab per window is highlighted, the user is selected tabs manually
			let selected_tabs = [];
			let win_first_tab = {};
			tabs.forEach( (tab) => {
				if (tab.highlighted)
				{
					const win = tab.windowId;
					//keep track of the first highlighted tab in window, dont do anything yet but we need to store a ref in case we see a second
					if (win_first_tab[win] === undefined)
					{
						win_first_tab[win] = tab;
					}
					else //we have seen this window before
					{
						//it is the second tab for this window so copy the first one we previously stored before copying the current
						if (win_first_tab[win] !== null)
						{
							selected_tabs.push(win_first_tab[win]);
						}
						//copy the current
						selected_tabs.push(tab);
						win_first_tab[win] = null;
					}
				}
			});
			if (selected_tabs.length === 0)
			{
				selected_tabs = tabs;
			}
			
			let container = {url: null, title: null};
			let entries;
			let formatter;
			const platform = navigator.platform.toLowerCase();
			const nl = (platform.indexOf("win") !== -1 ? "\r\n" : platform.indexOf("mac") !== -1 ? "\r" : "\n");
			switch (format_select.value)
			{
				case 'list':
					entries = '';
					formatter  =  (done) => {
						if (done)
						{
							return entries.slice(0, -1*nl.length);
						}
						entries += container.url+nl;
					}
					break;
				case 'json':
					entries = [];
					formatter  =  (done) => {
						if (done)
						{
							return JSON.stringify(entries);
						}
						entries[entries.length]= {url: container.url, title: container.title};
					}
					break;
				case 'custom':
					// ?<=             (?:\\\\)*)                           ^                           [^\\]
					//lookbehind match pairs of backslashes from either the begining of the string or a non backslash char
					const regex = /(?<=(?:(?:^|[^\\])(?:\\\\)*))(\$url|\$title|\\r|\\n|\\t)/g;
					const lookup = {"\\r": "\r", "\\n": "\n", "\\t": "\t"}
					const format = custom_format_input.value;
					entries = '';
					formatter  =  (done) => {
						if (done)
						{
							return entries;
						}
						entries += format.replace(regex, (val) => {
							if (val[0] === '$')
							{
								return container[val.slice(1)];
							}
							return lookup[val];
						})
					}
			}
			selected_tabs.forEach( (tab) => {
				container.url = tab.url;
				container.title = tab.title;
				formatter()
			});
			const out = formatter(true);
			status_span.addEventListener('animationend', () => {
				status_span.innerText = '';
				status_span.classList.remove('fade');
			})
			navigator.clipboard.writeText(out).then(() => {
				show_msg(selected_tabs.length+' items copied')
			}, (e) => {
				show_msg('ERROR')
			})
		})
	})
})
paste_btn.addEventListener('click', (e) => {
	chrome.permissions.request({ permissions: ["clipboardRead"] }, (granted) => {
		if (granted)
		{
			chrome.runtime.sendMessage({type: "paste"});
		}
		else
		{
			show_msg('Permission Error')
		}
	});
})
chrome.runtime.onMessage.addListener( (request, sender, sendResponse) => {
	if (typeof request.type !== "string")
	{
		return;
	}
	switch (request.type)
	{
		case 'paste_result':
			if (request.error !== null)
			{
				show_msg(request.error)
			}
			else
			{
				let urls = [];
				try {
					let json = JSON.parse(request.text);
					if ($.isArray(json))
					{
						json.forEach( (item) => {
							if (typeof item === 'object' && item !== null && typeof item.url === "string")
							{
								urls[urls.length] = item.url;
							}
						});
					}
				} catch (e) {}
				if (urls.length === 0)
				{
					urls = request.text.split(/(\r\n|\r|\n)/).filter( (url) => { return !url.match(/^\s+$/) }) 
				}
				urls.forEach( (line) => {
					chrome.tabs.create({url: line});
				})
			}
			break;
	}
});