.PHONY: test benchmark

cleanup:
	rm -rf ./build

compile: cleanup
	./node_modules/truffle/build/cli.bundled.js compile
	node scripts/checkContractSize.js
	tput bel

validate:
	npm run solium
	npm run eslint

only-skip:
	./scripts/only-skip.sh

only-recover:
	./scripts/only-recover.sh

test: only-skip
	-npm test
	tput bel
	$(MAKE) only-recover

retest: cleanup test

check-size:
	node scripts/checkContractSize.js
	
benchmark:
	for file in `ls ./benchmark`; do echo \\n$${file}\\n; ./node_modules/.bin/truffle exec benchmark/$${file} --network test -c; done
	
report:
	for file in `ls ./report | grep js`; do echo \\n$${file}\\n; ./node_modules/.bin/truffle exec report/$${file} --network test -c; done

deploy-ganache:
	rm -rf build && truffle migrate --network ganache && ./node_modules/.bin/surge ./deployed $$DOMAIN
	
deploy-testnet57:
	rm -rf build && truffle migrate --network testnet57 && ./node_modules/.bin/surge ./deployed $$DOMAIN
	
deploy-local:
	rm -rf build && truffle migrate --network local && ./node_modules/.bin/surge ./deployed $$DOMAIN
