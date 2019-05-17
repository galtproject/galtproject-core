.PHONY: test benchmark report

cleanup:
	rm -rf ./build

compile: cleanup
	npm run compile
	node scripts/checkContractSize.js
	tput bel

validate:
	npm run ethlint
	npm run eslint

only-skip:
	./scripts/only-skip.sh

only-recover:
	./scripts/only-recover.sh

test: only-skip
	-npm test
	tput bel
	$(MAKE) only-recover

ctest: compile test

retest: cleanup test

check-size:
	node scripts/checkContractSize.js
	
benchmark:
	for file in `ls ./benchmark`; do echo \\n$${file}\\n; ./node_modules/.bin/truffle exec benchmark/$${file} --network test -c; done
