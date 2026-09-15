
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { APP_NAME, COMPANY_ADDRESS, COMPANY_CONTACT } from "@/lib/constants";

export function ContactSection() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Message submitted! (This is a demo)");
  };

  const emailMatch = COMPANY_CONTACT.match(/Email: ([\w.-]+@[\w.-]+\.\w+)/);
  const phoneMatch = COMPANY_CONTACT.match(/Phone: ([\(\)\d\s-]+)/);
  const displayEmail = emailMatch ? emailMatch[1] : `contact@${APP_NAME.toLowerCase().replace(/\s+/g, '')}.com`;
  const displayPhone = phoneMatch ? phoneMatch[1] : '(555) 000-0000';

  return (
    <section id="contact" className="section-padding bg-background dark:bg-tertiary">
      <div className="section-container">
        <div className="text-center mb-16 md:mb-20">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Get in <span className="text-gradient-primary">Touch</span>
          </h2>
          <p className="mt-6 max-w-xl mx-auto text-lg text-muted-foreground">
            Have questions, feedback, or need support? We&apos;re here to help you succeed.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-start">
          <div className="space-y-10">
            <div>
              <h3 className="text-2xl font-semibold text-primary mb-5">Contact Information</h3>
              <div className="space-y-5 text-muted-foreground">
                <p className="flex items-start gap-4 text-base transition-colors hover:text-primary">
                  <MapPin className="h-7 w-7 text-secondary shrink-0 mt-0.5" />
                  <span>{COMPANY_ADDRESS}</span>
                </p>
                <p className="flex items-center gap-4 text-base">
                  <Mail className="h-7 w-7 text-secondary shrink-0" />
                  <a href={`mailto:${displayEmail}`} className="hover:text-primary transition-colors">{displayEmail}</a>
                </p>
                <p className="flex items-center gap-4 text-base">
                  <Phone className="h-7 w-7 text-secondary shrink-0" />
                  <a href={`tel:${displayPhone.replace(/[^\d+]/g, '')}`} className="hover:text-primary transition-colors">{displayPhone}</a>
                </p>
              </div>
            </div>
            <div className="pt-4">
              <h3 className="text-2xl font-semibold text-primary mb-5">Office Hours</h3>
              <p className="text-muted-foreground text-base">Monday - Friday: 9:00 AM - 6:00 PM</p>
              <p className="text-muted-foreground text-base">Saturday: 10:00 AM - 3:00 PM</p>
              <p className="text-muted-foreground text-base">Sunday: Closed</p>
            </div>
          </div>
          <form 
            onSubmit={handleSubmit} 
            className="space-y-8 p-8 md:p-10 bg-card rounded-2xl shadow-2xl dark:shadow-primary/15 border border-border/70"
          >
            <div>
              <Label htmlFor="contact-name" className="text-foreground font-medium text-base">Full Name</Label>
              <Input id="contact-name" type="text" placeholder="Your Name" required className="mt-2.5 h-12 text-base rounded-lg" />
            </div>
            <div>
              <Label htmlFor="contact-email" className="text-foreground font-medium text-base">Email Address</Label>
              <Input id="contact-email" type="email" placeholder="you@example.com" required className="mt-2.5 h-12 text-base rounded-lg" />
            </div>
            <div>
              <Label htmlFor="contact-subject" className="text-foreground font-medium text-base">Subject</Label>
              <Input id="contact-subject" type="text" placeholder="Regarding..." className="mt-2.5 h-12 text-base rounded-lg" />
            </div>
            <div>
              <Label htmlFor="contact-message" className="text-foreground font-medium text-base">Message</Label>
              <Textarea id="contact-message" placeholder="How can we help you?" required rows={6} className="mt-2.5 text-base rounded-lg" />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/85 text-primary-foreground py-3.5 text-lg rounded-xl group transition-all-fast transform hover:scale-105 focus:scale-105 focus:ring-4 focus:ring-primary/30">
              Send Message <Send className="ml-2.5 h-5 w-5 group-hover:translate-x-1 transition-transform-fast" />
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}

    