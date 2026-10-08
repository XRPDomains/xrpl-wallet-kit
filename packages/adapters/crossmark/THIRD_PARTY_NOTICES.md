# Third-Party Notices

The prepared adapter artifact includes the runtime of `@crossmarkio/sdk@0.4.0`.
It does not expose or redistribute the SDK's declaration namespace; the public
adapter declarations use Wallet Kit's own `CrossmarkProvider` interface.

The SDK npm manifest declares MIT, but its published `LICENSE` contains GNU
General Public License version 3 text. Package preparation preserves the exact
shipped text in `dist/licenses/CROSSMARK-LICENSE.txt` and rejects a changed
version or license. This notice records the discrepancy without resolving the
publisher's intended license. Clarification and a redistribution review remain
required before release; retaining a notice alone is not a licensing clearance.

Upstream artifact:
https://registry.npmjs.org/@crossmarkio/sdk/-/sdk-0.4.0.tgz

This packaging change removes the SDK/typings dependency installation chain
from the prepared adapter's runtime manifest. It does not patch upstream
cryptography or remove the development workspace's audit findings.
