<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$bhb_states  = bhb_states();
$bhb_email   = get_theme_mod( 'bhb_email', 'hello@backhomebuddy.ng' );
$bhb_phone   = get_theme_mod( 'bhb_phone', '' );
$bhb_privacy = get_theme_mod( 'bhb_privacy', '/privacy-policy/' );
$bhb_terms   = get_theme_mod( 'bhb_terms', '/terms-of-service/' );
?>
</main>

<footer class="bhb-footer">
	<div class="bhb-wrap">
		<div class="bhb-footer__grid">
			<div>
				<a class="bhb-logo" href="<?php echo esc_url( home_url( '/' ) ); ?>" rel="home">
					<?php
					if ( has_custom_logo() ) {
						the_custom_logo();
					} else {
						echo '<span class="bhb-logo__text">' . esc_html( get_bloginfo( 'name' ) ) . '</span>';
					}
					?>
				</a>
				<p class="bhb-footer__blurb">
					Things done in Nigeria for people who are not in Nigeria, with evidence you can check and a refund
					policy written down before you pay.
				</p>
				<?php if ( ! empty( $bhb_states ) ) : ?>
					<p class="bhb-footer__states">Working in <?php echo esc_html( implode( ', ', $bhb_states ) ); ?>.</p>
				<?php endif; ?>
			</div>

			<div>
				<p class="bhb-footer__head">Pages</p>
				<?php
				if ( has_nav_menu( 'footer' ) ) {
					wp_nav_menu( array(
						'theme_location' => 'footer',
						'container'      => false,
						'menu_class'     => 'bhb-footer__list',
						'depth'          => 1,
						'fallback_cb'    => false,
					) );
				}
				?>
			</div>

			<div>
				<p class="bhb-footer__head">Get in touch</p>
				<ul class="bhb-footer__list">
					<?php if ( $bhb_email ) : ?>
						<li><a href="mailto:<?php echo esc_attr( $bhb_email ); ?>"><?php echo esc_html( $bhb_email ); ?></a></li>
					<?php endif; ?>
					<?php if ( $bhb_phone ) : ?>
						<li><a href="tel:<?php echo esc_attr( preg_replace( '/[^0-9+]/', '', $bhb_phone ) ); ?>"><?php echo esc_html( $bhb_phone ); ?></a></li>
					<?php endif; ?>
					<li><a href="<?php echo esc_url( $bhb_privacy ); ?>">Privacy policy</a></li>
					<li><a href="<?php echo esc_url( $bhb_terms ); ?>">Terms of service</a></li>
				</ul>
			</div>
		</div>

		<?php
		/**
		 * The money sentence.
		 *
		 * It says what actually happens rather than borrowing a regulated word.
		 * The old site implied escrow; this does not, because this business is
		 * not one and saying so is both honest and safer.
		 */
		?>
		<p class="bhb-footer__legal">
			Backhome Buddy holds your payment against your task and releases it to your buddy only after the work is
			done and you have accepted the proof. It is not a bank and not a regulated escrow service.
			&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> Backhome Buddy.
		</p>
	</div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
