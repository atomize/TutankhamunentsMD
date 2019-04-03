else if (argv.output == 'github') {
                if (!argv.username && !argv.password) {
                    return
                }
                let base64dom = dom.window.btoa(dom.serialize())
                console.log(base64dom)
                let postParams = {
                    "content": base64dom,
                    "encoding": "base64"
                }

                function submitBlob(opts) {
                    ChromeSamples.log('Posting request to GitHub API...');
                    fetch(argv.url, {
                        method: 'post',
                        body: JSON.stringify(opts)
                    }).then(function (response) {
                        return response.json();
                    }).then(function (data) {
                        ChromeSamples.log('Created Gist:', data.html_url);
                    });
                }
            }