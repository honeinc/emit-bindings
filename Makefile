UGLIFY ?= uglifyjs2
DIST ?= built
BUILT ?= $(DIST)/emit.js

all: component min

min: $(BUILT:.js=.min.js)

%.min.js: %.js
	@$(UGLIFY) $< -o $@

component: index.js
	component build -o $(DIST) -n emit -s Emit

clean:
	@rm -rf $(DIST)

.PHONY: clean all