FORMAT := build/tools/sugarcube-format.js
FORMAT_URL := https://raw.githubusercontent.com/tmedwards/sugarcube-2/v2.37.3/dist/format.js
EXTWEE := npx --yes extwee@2.3.18

.PHONY: build format clean

build: format
	$(EXTWEE) -c -i src/story.tw -o index.html -s $(FORMAT)

format:
	@mkdir -p build/tools
	@[ -f $(FORMAT) ] || curl -sSL -o $(FORMAT) $(FORMAT_URL)

clean:
	rm -f index.html
