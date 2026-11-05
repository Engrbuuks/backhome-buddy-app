=== Backhome Buddy Content ===
Requires at least: 6.0
Requires PHP: 7.4
Stable tag: 1.0.0

Renders the service catalogue, prices, states, vetting steps and proof blocks
on backhomebuddy.ng, read live from the app.

== Why ==

The website and the app drifted apart. The homepage went on advertising eight
services after two had been retired, and carried figures for tasks completed
and client satisfaction that nothing in the system had ever produced. Hand
maintained copy of a catalogue always ends that way.

Nothing in this plugin is typed in. It reads the live catalogue from the app
and caches it for six hours, so deactivating a service in the admin removes it
from this website the same day without anybody editing a page.

== Setup ==

1. Plugins, Add New, Upload Plugin, choose the zip, Install, Activate.
2. Settings, Backhome Buddy. Put the app address in, with no trailing slash,
   for example https://app.backhomebuddy.ng
3. Press Refresh now. The table should fill with your services.
4. Put the shortcodes on the pages (list on the settings screen).

== Shortcodes ==

[bhb_services]                                    whole catalogue with prices
[bhb_services mode="pay_now" heading="..."]       only the fixed price ones
[bhb_services mode="quoted" heading="..."]        only the quoted ones
[bhb_vetting heading="..."]                       vetting steps, in order
[bhb_vetting limit="6"]                           first six, for a homepage
[bhb_vetting_caveat]                              what we do not claim
[bhb_proof]                                       the two proof stamps
[bhb_states]                                      states actually worked in

== Notes ==

If the app cannot be reached the last good copy is shown rather than an empty
section, so a network blip never blanks a page.

The caveat block is deliberately hard coded. It is a statement about what the
business does NOT do, and it should only change when somebody decides to
change it.
