import React from "react";
import { Link } from "react-router-dom";

//@ts-expect-error - This is a forwardRef
export const NavLink = React.forwardRef(({ href, children, ...rest }, ref) => (
    //@ts-expect-error - This is a forwardRef
    <Link ref={ref} to={href} {...rest}>
        {children}
    </Link>
));
