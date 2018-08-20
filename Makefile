.PHONY: test

compile:
	rm -rf ./build
	truffle compile

validate:
	npm run solium
	npm run eslint

test:
	npm test
