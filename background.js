cb = document.createElement('textarea')
document.body.append(cb)
chrome.runtime.onMessage.addListener( (request, sender, sendResponse) => {
	if (typeof request.type !== "string")
	{
		return;
	}
	switch (request.type)
	{
		case 'paste':
			let ret = {type: "paste_result", error: null, text: null};
			cb.value = ''
			cb.select()
			document.execCommand('paste')
			ret.text = cb.value;
			setTimeout( function () {
				chrome.runtime.sendMessage(ret);
			}, 0)
			return;
			/*
			navigator.clipboard.readText().then( (text) => {
				ret.text = text;
			}).catch( (error) => {
				ret.error = error.message;
			}).finally( () => {
				chrome.runtime.sendMessage(ret);
			})
			break;*/
	}
});