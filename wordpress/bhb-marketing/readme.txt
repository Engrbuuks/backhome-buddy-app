=== Backhome Buddy ===
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later

The marketing site for backhomebuddy.ng.

== The point of it ==

The service list, prices, states and vetting steps are NOT written into this
theme. They are read from the app and cached for six hours.

The old site kept its own copy of the catalogue, so when two services were
retired it went on advertising them, and it carried figures for tasks
completed and client satisfaction that nothing in the system had ever
produced. A hand maintained copy of a catalogue always ends that way.

Deactivate a service in the app's admin and it leaves this website the same
day, without anybody editing a page.

== Setup, about ten minutes ==

1. Appearance, Themes, Add New, Upload Theme, choose the zip, Install,
   Activate.
2. Appearance, Customize, Backhome Buddy. Put in the app address with no
   trailing slash, for example https://app.backhomebuddy.ng
   Set the contact email, and the privacy and terms URLs if yours differ.
3. Appearance, Customize, Site Identity, upload the logo.
4. Appearance, Themes, BHB catalogue. Press Refresh now. The table should fill
   with your services. If it does not, the app address is wrong.
5. Create two pages:
     "What we do"     template: Services and prices   slug: services
     "How we vet"     template: How we vet            slug: how-we-vet
   (The front page links to /services/ and /how-we-vet/, so keep those slugs
   or edit front-page.php.)
6. Settings, Reading: set the front page to a static page.
7. Appearance, Menus: build a Primary menu and a Footer menu.

== Shortcodes, for any other page ==

[bhb_services]                                 whole catalogue with prices
[bhb_services mode="pay_now" heading="..."]    only the fixed price ones
[bhb_services mode="quoted" heading="..."]     only the quoted ones
[bhb_vetting heading="..."]                    vetting steps, in order
[bhb_vetting limit="6"]                        first six, for a homepage
[bhb_vetting_caveat]                           what we do not claim
[bhb_proof]                                    the two proof stamps
[bhb_states]                                   states actually worked in

== What was corrected ==

* The invented track record is gone. There are no statistics anywhere in this
  theme, and none can be added by accident, because nothing counts anything.
* The catalogue comes from the app, so retired services cannot linger.
* "Background checks" is gone. The vetting page says exactly what is done and
  then says plainly that a criminal record check is not among it. That
  admission is the reason to believe the rest.
* The proof claim is qualified. Both stamps are shown: the verified one and
  the uploaded one that says it carries no location.
* The footer describes what happens to your money without borrowing the word
  escrow, which this business is not.

== Notes ==

If the app cannot be reached the last good copy is shown rather than an empty
section, so a network blip never blanks a page.

The caveat block is deliberately hard coded. It is a statement about what the
business does NOT do, and it should change only when somebody decides to
change it.

You do not need the Backhome Buddy Content plugin alongside this theme. If
both are active the plugin owns the shortcodes and the theme steps aside.
